export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { generateTimeSlots } from "@/lib/booking/slots"
import type { Business, WorkingHours, WorkingHourBreak, Appointment } from "@/types/database"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const businessId   = searchParams.get("business_id")
  const date         = searchParams.get("date")
  const duration     = Number(searchParams.get("duration") ?? "30")
  const staffId      = searchParams.get("staff_id") ?? null

  if (!businessId || !date) {
    return NextResponse.json({ error: "business_id and date are required" }, { status: 400 })
  }

  // Service role: availability needs to see every booked slot to compute
  // conflicts, which must not depend on a public read policy over appointments.
  // Only derived free/busy times are returned to the caller.
  const supabase = createServiceClient()

  const { data: business } = await supabase
    .from("businesses")
    .select("booking_mode, group_capacity, slot_interval, active")
    .eq("id", businessId)
    .single() as {
      data: Pick<Business, "booking_mode" | "group_capacity" | "slot_interval" | "active"> | null
    }

  if (!business || business.active === false) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 })
  }

  const capacity = business.booking_mode === "group" ? business.group_capacity : 1

  // Get day of week
  const [y, m, d] = date.split("-").map(Number)
  const dow = new Date(y, m - 1, d).getDay()

  // Fetch working hours for this day
  const { data: wh } = await supabase
    .from("working_hours")
    .select("*")
    .eq("business_id", businessId)
    .eq("day_of_week", dow)
    .maybeSingle() as { data: WorkingHours | null }

  if (!wh || !wh.is_open) {
    return NextResponse.json({ slots: [] })
  }

  const { data: breaks } = await supabase
    .from("working_hour_breaks")
    .select("start_time, end_time")
    .eq("business_id", businessId)
    .eq("day_of_week", dow)
    .order("start_time") as {
      data: Pick<WorkingHourBreak, "start_time" | "end_time">[] | null
    }

  // Fetch existing appointments for this date
  let query = supabase
    .from("appointments")
    .select("start_time, end_time, participants_count")
    .eq("business_id", businessId)
    .eq("appointment_date", date)
    .neq("status", "cancelled")

  if (staffId) {
    query = query.eq("staff_member_id", staffId)
  }

  const { data: existing } = await query as {
    data: Pick<Appointment, "start_time" | "end_time" | "participants_count">[] | null
  }

  const interval = business.slot_interval ?? 30
  const slots = generateTimeSlots(wh, existing ?? [], duration, interval, capacity, breaks ?? [])

  return NextResponse.json({ slots, booking_mode: business.booking_mode, capacity })
}
