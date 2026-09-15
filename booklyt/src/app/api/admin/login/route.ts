import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyAdminPassword } from "@/lib/admin-password"
import { adminSessionMaxAge, getAdminCookieName, signAdminSession } from "@/lib/admin-session"
import { z } from "zod"

const loginSchema = z.object({
  slug: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createClient() as any
    const { data: business } = await supabase
      .from("businesses")
      .select("id, admin_password_hash, admin_password_salt")
      .eq("slug", parsed.data.slug)
      .maybeSingle() as {
        data: { id: string; admin_password_hash: string | null; admin_password_salt: string | null } | null
      }

    if (!business?.admin_password_hash || !business.admin_password_salt) {
      return NextResponse.json({ error: "Admin access is not enabled for this business." }, { status: 404 })
    }

    const ok = verifyAdminPassword(
      parsed.data.password,
      business.admin_password_salt,
      business.admin_password_hash
    )

    if (!ok) {
      return NextResponse.json({ error: "Wrong password" }, { status: 401 })
    }

    const response = NextResponse.json({ success: true })
    const requestUrl = new URL(request.url)
    response.cookies.set(getAdminCookieName(business.id), signAdminSession(business.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: requestUrl.protocol === "https:",
      path: "/",
      maxAge: adminSessionMaxAge,
    })

    return response
  } catch (err) {
    console.error("Admin login error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
