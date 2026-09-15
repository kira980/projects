import { NextResponse } from "next/server"
import { getAdminVerifiedBusiness } from "@/lib/admin-business"
import { sendBusinessPushNotification } from "@/lib/push/send"

type RouteContext = {
  params: Promise<{ businessSlug: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { businessSlug } = await context.params
  const { business } = await getAdminVerifiedBusiness(businessSlug)

  if (!business) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await sendBusinessPushNotification(business.id, {
    title: `${business.name} Admin`,
    body: "Test notification received. New booking alerts will appear here.",
    url: `/admin/${business.slug}`,
    icon: business.app_icon_url || business.logo_url,
  })

  return NextResponse.json({ success: true, result })
}
