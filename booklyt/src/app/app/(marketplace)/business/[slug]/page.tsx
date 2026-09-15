import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, MapPin, Phone, Share2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { getBusinessBySlug } from '@/lib/marketplace/queries'
import { resolveBusinessCode } from '@/lib/business-code'
import { BUSINESS_CODE_REGEX } from '@/lib/booklyt'
import { SectionRenderer } from '@/components/sections/SectionRenderer'
import { TenantThemeProvider } from '@/components/theme/TenantThemeProvider'
import { TrackVisit } from '@/components/marketplace/TrackVisit'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (BUSINESS_CODE_REGEX.test(slug)) return { title: 'Booklyt' }
  const biz = await getBusinessBySlug(slug)
  if (!biz) return { title: 'Business not found' }
  return {
    title: biz.displayName,
    description: biz.publishedConfig?.content?.heroSubtitle ?? `Book appointments at ${biz.displayName}`,
  }
}

export default async function BusinessProfilePage({ params }: Props) {
  const { slug } = await params

  // Universal-link form: /app/business/<6-digit code> — resolve the business
  // code and open the business mini-app. Slugs are never 6 digits.
  if (BUSINESS_CODE_REGEX.test(slug)) {
    const resolved = await resolveBusinessCode(slug)
    if (!resolved || !resolved.appEnabled) notFound()
    redirect(`/app/${resolved.slug}`)
  }

  const biz = await getBusinessBySlug(slug)
  if (!biz) notFound()

  const pub = biz.publishedConfig

  // If no published config, show a minimal fallback profile
  if (!pub) {
    return (
      <div>
        <TrackVisit slug={slug} />
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-zinc-100 flex items-center gap-3 px-4 py-3">
          <Link href="/app" className="p-1.5 rounded-xl hover:bg-zinc-100">
            <ArrowLeft className="w-5 h-5 text-zinc-700" />
          </Link>
          <h1 className="font-bold text-zinc-900 flex-1 truncate">{biz.displayName}</h1>
        </div>

        <div className="px-5 py-8 text-center">
          <div
            className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold shadow"
            style={{ background: biz.primaryColor }}
          >
            {biz.displayName.slice(0, 2).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-1">{biz.displayName}</h2>
          {biz.category && <p className="text-zinc-400 text-sm capitalize mb-4">{biz.category}</p>}
          {biz.address && (
            <div className="flex items-center justify-center gap-1 text-zinc-500 text-sm mb-6">
              <MapPin className="w-4 h-4" />
              <span>{biz.address}</span>
            </div>
          )}
          <Link
            href={`/app/book/${slug}`}
            className="inline-flex items-center gap-2 text-white font-bold px-8 py-3 rounded-2xl shadow"
            style={{ background: biz.primaryColor }}
          >
            Book Now
          </Link>
        </div>
      </div>
    )
  }

  return (
    <TenantThemeProvider brand={pub.brand}>
      <TrackVisit slug={slug} />
      {/* Sticky header with back + share */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-zinc-100">
        <div className="flex items-center gap-2 px-4 py-3 max-w-lg mx-auto">
          <Link href="/app" className="p-1.5 rounded-xl hover:bg-zinc-100 flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-zinc-700" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {biz.logoUrl && (
              <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
                <Image src={biz.logoUrl} alt={biz.displayName} width={28} height={28} className="w-full h-full object-cover" />
              </div>
            )}
            <h1 className="font-bold text-zinc-900 truncate">{biz.displayName}</h1>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {biz.phone && (
              <a href={`tel:${biz.phone}`} className="p-1.5 rounded-xl hover:bg-zinc-100">
                <Phone className="w-4.5 h-4.5 text-zinc-600" />
              </a>
            )}
            <button className="p-1.5 rounded-xl hover:bg-zinc-100">
              <Share2 className="w-4 h-4 text-zinc-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Full builder-rendered sections */}
      <div className="max-w-lg mx-auto">
        <SectionRenderer
          brand={pub.brand}
          layout={pub.layout}
          content={pub.content}
          business={biz.business}
          services={biz.services}
          staff={biz.staff}
          workingHours={biz.workingHours}
          bookingUrl={`/app/book/${slug}`}
          forceMobileLayout
        />
      </div>
    </TenantThemeProvider>
  )
}
