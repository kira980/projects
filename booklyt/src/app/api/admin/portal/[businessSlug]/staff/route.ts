import { NextResponse } from "next/server"
import { z } from "zod"
import { getAdminVerifiedBusiness } from "@/lib/admin-business"

type RouteContext = { params: Promise<{ businessSlug: string }> }

const staffSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  role: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  active: z.boolean().default(true),
})

export async function POST(request: Request, context: RouteContext) {
  const { businessSlug } = await context.params
  const { business, supabase } = await getAdminVerifiedBusiness(businessSlug)
  if (!business) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = staffSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid staff member" }, { status: 400 })

  const { id, ...data } = parsed.data
  const payload = { ...data, business_id: business.id, updated_at: new Date().toISOString() }
  const query = id
    ? supabase.from("staff_members").update(payload).eq("business_id", business.id).eq("id", id)
    : supabase.from("staff_members").insert(payload)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request, context: RouteContext) {
  const { businessSlug } = await context.params
  const { business, supabase } = await getAdminVerifiedBusiness(businessSlug)
  if (!business) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const { error } = await supabase.from("staff_members").delete().eq("business_id", business.id).eq("id", id)
  if (!error) return NextResponse.json({ success: true })

  const { error: deactivateError } = await supabase
    .from("staff_members")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .eq("id", id)

  if (deactivateError) return NextResponse.json({ error: deactivateError.message }, { status: 500 })
  return NextResponse.json({ success: true, deactivated: true })
}
