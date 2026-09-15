import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

type RouteContext = { params: Promise<{ token: string }> }

export async function GET(_req: Request, ctx: RouteContext) {
  const { token } = await ctx.params
  if (!token || token.length < 10) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id,
      appointment_date,
      start_time,
      end_time,
      status,
      participants_count,
      customer_name,
      customer_confirmed_at,
      businesses(name, slug, language, customer_confirmation_enabled),
      services(name, price, duration_minutes),
      staff_members(name)
    `)
    .eq("manage_token", token)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(data)
}
