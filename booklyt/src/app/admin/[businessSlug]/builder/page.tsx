import { redirect } from "next/navigation"
import BuilderPage from "@/app/dashboard/builder/page"
import { getAdminVerifiedBusiness } from "@/lib/admin-business"

type PageProps = {
  params: Promise<{ businessSlug: string }>
}

export default async function AdminBuilderPage({ params }: PageProps) {
  const { businessSlug } = await params
  const { business } = await getAdminVerifiedBusiness(businessSlug)

  if (!business) {
    redirect(`/admin/${businessSlug}`)
  }

  return <BuilderPage />
}
