import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getAdminCookieName, verifyAdminSession } from "@/lib/admin-session"
import { PwaInstallCard } from "@/components/pwa-install-card"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { dirForLocale, getDictionary, normalizeLocale } from "@/lib/i18n"
import type { Business } from "@/types/database"
import { AdminLoginForm } from "./admin-login-form"
import { AdminPortalClient } from "./admin-portal-client"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ businessSlug: string }>
}

type AdminBusiness = Business & {
  admin_password_hash: string | null
  admin_password_salt: string | null
}

export default async function BusinessAdminPage({ params }: PageProps) {
  const { businessSlug } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", businessSlug)
    .maybeSingle() as { data: AdminBusiness | null }

  if (!business) {
    notFound()
  }

  const cookieStore = await cookies()
  const loggedIn = verifyAdminSession(cookieStore.get(getAdminCookieName(business.id))?.value, business.id)
  const adminEnabled = Boolean(business.admin_password_hash && business.admin_password_salt)
  const adminAppName = `${business.app_name?.trim() || business.name} Admin`
  const adminIconUrl = business.app_icon_url || business.logo_url
  const locale = normalizeLocale(business.language)
  const t = getDictionary(locale)

  if (adminEnabled && loggedIn) {
    return (
      <div dir={dirForLocale(locale)} className="flex h-screen overflow-hidden bg-zinc-50">
        <AdminSidebar business={business} />
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-0" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl pt-0">
            <AdminPortalClient slug={business.slug} />
          </div>
        </main>
        <PwaInstallCard appName={adminAppName} iconUrl={adminIconUrl} />
      </div>
    )
  }

  return (
    <main dir={dirForLocale(locale)} className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
                {t.common.businessAdmin}
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">
                {business.name}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {t.admin.sharedIntro}
              </p>
            </div>
            <div className="rounded-full bg-violet-50 p-3 text-violet-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          {!adminEnabled ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t.admin.notEnabled}
            </div>
          ) : (
            <AdminLoginForm slug={business.slug} language={locale} />
          )}
        </div>
      </div>
      <PwaInstallCard appName={adminAppName} iconUrl={adminIconUrl} />
    </main>
  )
}
