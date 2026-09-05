import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, findUserById } from "@/lib/demo-backend/auth";

/**
 * Guards the admin area.
 *
 * Production refreshed a Supabase Auth session here on every dashboard
 * request. The demo has no tokens to refresh, but the *gate* is the same and
 * still runs before the page: no session, no dashboard.
 *
 * The staff apps (kiosk, production, driver, attendance) are deliberately
 * untouched — they authenticate with their own passcode-session cookies, so
 * this returns early for them exactly as it always did.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  const usesAdminAuth = path.startsWith("/dashboard") || path === "/login";
  if (!usesAdminAuth) return response;

  const userId = request.cookies.get(AUTH_COOKIE)?.value;
  const user = userId ? findUserById(userId) : null;

  if (!user && path.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/simple";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
