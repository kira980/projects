import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ token: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const { token } = await context.params
  // Service role: authorization here is the unguessable manage_token, not RLS.
  // With the anon client the UPDATE below matched no policy and silently
  // affected 0 rows while still reporting success.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  // Find appointment
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, status, appointment_date, start_time, business_id, customer_confirmed_at, businesses(customer_confirmation_enabled)")
    .eq("manage_token", token)
    .maybeSingle()

  if (!appt) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
  }

  const biz = appt.businesses as { customer_confirmation_enabled: boolean } | null
  if (!biz?.customer_confirmation_enabled) {
    return NextResponse.json({ error: "Customer confirmation is not enabled for this business" }, { status: 403 })
  }

  if (appt.status === "cancelled") {
    return NextResponse.json({ error: "This appointment has been cancelled" }, { status: 400 })
  }

  if (appt.customer_confirmed_at) {
    return NextResponse.json({ already: true })
  }

  const { error } = await supabase
    .from("appointments")
    .update({ customer_confirmed_at: new Date().toISOString(), status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", appt.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ confirmed: true })
}
