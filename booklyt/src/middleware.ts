import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

// True only when the project URL looks like a real Supabase endpoint.
// Prevents fetch errors when env vars are missing or contain placeholder values.
const supabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_URL.includes(".supabase.co") &&
  SUPABASE_ANON_KEY.length > 20

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach(cookie => {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.delete(cookie.name)
    }
  })
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding")
  const isAuthPage = pathname === "/auth/login" || pathname === "/auth/signup"

  if (!isProtected && !isAuthPage) {
    return NextResponse.next({ request })
  }

  // If Supabase isn't configured (missing/placeholder env vars), treat every
  // request as unauthenticated so protected routes redirect to login cleanly
  // without emitting "fetch failed" sandbox errors.
  if (!supabaseConfigured) {
    if (isProtected) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })
  let user = null
  let authErrored = false

  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    // getSession() is cookie-only but in some @supabase/ssr versions it still
    // triggers an auto-refresh if the access token is expired. Wrap everything
    // so a stale/missing refresh token never surfaces as an unhandled rejection.
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      // getUser() validates against the Supabase server and may internally call
      // refreshSession(). Both the thrown-error and the returned-error paths are
      // handled so the invalid-refresh-token error never escapes the middleware.
      const { data: { user: authUser }, error } = await supabase.auth.getUser()
      if (error) {
        authErrored = true
      } else {
        user = authUser
      }
    }
  } catch {
    // Thrown by refreshSession when refresh token is invalid/not found.
    authErrored = true
  }

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    const response = NextResponse.redirect(url)
    if (authErrored) clearSupabaseAuthCookies(request, response)
    return response
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  if (authErrored) clearSupabaseAuthCookies(request, supabaseResponse)

  return supabaseResponse
}

export const config = {
  // Only run middleware on routes that actually need auth checks.
  // Excluding API routes, static files, and public pages avoids unnecessary
  // Supabase token-refresh calls and eliminates "fetch failed" noise on those paths.
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/auth/login",
    "/auth/signup",
  ],
}
