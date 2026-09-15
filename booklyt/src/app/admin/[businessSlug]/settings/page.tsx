import { redirect } from "next/navigation"
import { getAdminVerifiedBusiness } from "@/lib/admin-business"
import { AdminSettingsClient } from "./settings-client"

type PageProps = {
  params: Promise<{ businessSlug: string }>
}

export default async function AdminSettingsPage({ params }: PageProps) {
  const { businessSlug } = await params
  const { business } = await getAdminVerifiedBusiness(businessSlug)

  if (!business) {
    redirect(`/admin/${businessSlug}`)
  }

  return <AdminSettingsClient slug={businessSlug} />
}
