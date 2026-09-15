import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShareAppCard } from '@/components/share-app/ShareAppCard'
import { AnnouncementComposer } from '@/components/share-app/AnnouncementComposer'
import { getDictionary, normalizeLocale } from '@/lib/i18n'
import { BOOKLYT } from '@/lib/booklyt'

export const dynamic = 'force-dynamic'

export default async function SharePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: business } = await (supabase as any)
    .from('businesses')
    .select('id, slug, name, business_code, language')
    .eq('owner_id', user.id)
    .maybeSingle() as { data: { id: string; slug: string; name: string; business_code: string | null; language: 'en' | 'ar' } | null }

  if (!business) redirect('/onboarding')

  const locale = normalizeLocale(business.language)
  const t = getDictionary(locale).share

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">{t.title}</h1>
        <p className="text-sm text-zinc-400 mt-1">{t.subtitle}</p>
      </div>

      <div className="space-y-5">
        <ShareAppCard
          slug={business.slug}
          businessCode={business.business_code}
          origin={BOOKLYT.domain}
          language={locale}
        />
        <AnnouncementComposer endpoint="/api/dashboard/announcements" language={locale} />
      </div>
    </div>
  )
}
