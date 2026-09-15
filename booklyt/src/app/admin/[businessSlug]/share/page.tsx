import { notFound } from 'next/navigation'
import { getAdminVerifiedBusiness } from '@/lib/admin-business'
import { ShareAppCard } from '@/components/share-app/ShareAppCard'
import { AnnouncementComposer } from '@/components/share-app/AnnouncementComposer'
import { dirForLocale, getDictionary, normalizeLocale } from '@/lib/i18n'
import { BOOKLYT } from '@/lib/booklyt'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ businessSlug: string }> }

export default async function AdminSharePage({ params }: PageProps) {
  const { businessSlug } = await params
  const { business, supabase } = await getAdminVerifiedBusiness(businessSlug)
  if (!business) notFound()

  const { data: codeRow } = await supabase
    .from('businesses')
    .select('business_code')
    .eq('id', business.id)
    .maybeSingle() as { data: { business_code: string | null } | null }

  const locale = normalizeLocale(business.language)
  const t = getDictionary(locale).share

  return (
    <main dir={dirForLocale(locale)} className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-zinc-900">{t.title}</h1>
          <p className="text-sm text-zinc-400 mt-1">{t.subtitle}</p>
        </div>
        <div className="space-y-5">
          <ShareAppCard
            slug={business.slug}
            businessCode={codeRow?.business_code ?? null}
            origin={BOOKLYT.domain}
            language={locale}
          />
          <AnnouncementComposer
            endpoint={`/api/admin/portal/${business.slug}/announcements`}
            language={locale}
          />
        </div>
      </div>
    </main>
  )
}
