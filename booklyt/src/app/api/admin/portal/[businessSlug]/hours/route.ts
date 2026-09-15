import { NextResponse } from "next/server"
import { z } from "zod"
import { getAdminVerifiedBusiness } from "@/lib/admin-business"

type RouteContext = { params: Promise<{ businessSlug: string }> }

const daySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  is_open: z.boolean(),
  open_time: z.string().nullable(),
  close_time: z.string().nullable(),
  breaks: z.array(z.object({
    start_time: z.string(),
    end_time: z.string(),
  })).default([]),
})

const hoursSchema = z.object({
  days: z.array(daySchema).length(7),
})

export async function POST(request: Request, context: RouteContext) {
  const { businessSlug } = await context.params
  const { business, supabase } = await getAdminVerifiedBusiness(businessSlug)
  if (!business) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = hoursSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid hours" }, { status: 400 })

  const rows = parsed.data.days.map(day => ({
    business_id: business.id,
    day_of_week: day.day_of_week,
    is_open: day.is_open,
    open_time: day.is_open && day.open_time ? `${day.open_time.slice(0, 5)}:00` : null,
    close_time: day.is_open && day.close_time ? `${day.close_time.slice(0, 5)}:00` : null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from("working_hours")
    .upsert(rows, { onConflict: "business_id,day_of_week" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: deleteError } = await supabase
    .from("working_hour_breaks")
    .delete()
    .eq("business_id", business.id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  const breaks = parsed.data.days.flatMap(day =>
    day.is_open
      ? day.breaks
          .filter(item => item.start_time && item.end_time && item.start_time < item.end_time)
          .map(item => ({
            business_id: business.id,
            day_of_week: day.day_of_week,
            start_time: `${item.start_time.slice(0, 5)}:00`,
            end_time: `${item.end_time.slice(0, 5)}:00`,
          }))
      : []
  )

  if (breaks.length) {
    const { error: breaksError } = await supabase.from("working_hour_breaks").insert(breaks)
    if (breaksError) return NextResponse.json({ error: breaksError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
