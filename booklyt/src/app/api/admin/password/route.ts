import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hashAdminPassword } from "@/lib/admin-password"
import { z } from "zod"

const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(request: Request) {
  try {
    const parsed = passwordSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid password", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { salt, hash } = hashAdminPassword(parsed.data.password)
    const now = new Date().toISOString()

    const { error } = await supabase
      .from("businesses")
      .update({
        admin_password_salt: salt,
        admin_password_hash: hash,
        admin_password_updated_at: now,
        updated_at: now,
      })
      .eq("owner_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Admin password error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
