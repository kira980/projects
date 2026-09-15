import Link from 'next/link'
import { Suspense } from 'react'
import { HomeHero } from '@/components/marketplace/HomeHero'
import { CategoryGrid } from '@/components/marketplace/CategoryGrid'
import { BusinessCard, BusinessCardSkeleton } from '@/components/marketplace/BusinessCard'
import { FindByCode } from '@/components/marketplace/FindByCode'
import { ScanQrButton } from '@/components/native/ScanQrButton'
import { HomeCustomerSections } from '@/components/marketplace/HomeCustomerSections'
import { getPublishedBusinesses, getPopularCategories, getMarketplaceStats } from '@/lib/marketplace/queries'
import { getCurrentCustomerUser } from '@/lib/customer-auth'
import { ArrowRight, Sparkles, Shield, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function NearbyBusinesses() {
  const businesses = await getPublishedBusinesses(8)

  if (!businesses.length) {
    return (
      <div className="text-center py-10 text-zinc-400">
        <p className="text-sm">No businesses yet.</p>
        <Link href="/onboarding" className="text-violet-600 text-sm font-medium">List your business →</Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {businesses.map(biz => (
        <BusinessCard key={biz.id} business={biz} />
      ))}
    </div>
  )
}

async function StatsBar() {
  const stats = await getMarketplaceStats()
  return (
    <div className="grid grid-cols-3 gap-3 px-5 py-4">
      {[
        { label: 'Businesses', value: stats.businessCount, icon: Shield },
        { label: 'Services', value: stats.serviceCount, icon: Sparkles },
        { label: 'Bookings', value: stats.bookingCount, icon: Clock },
      ].map(({ label, value, icon: Icon }) => (
        <div key={label} className="bg-white rounded-2xl p-3 text-center shadow-sm border border-zinc-100">
          <Icon className="w-4 h-4 text-violet-600 mx-auto mb-1" />
          <p className="font-bold text-zinc-900 text-base leading-none">{value}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

async function DynamicCategoryGrid() {
  const cats = await getPopularCategories()
  return <CategoryGrid dynamicCategories={cats} />
}

export default async function MarketplacePage() {
  const user = await getCurrentCustomerUser()

  return (
    <div>
      <HomeHero />

      {/* Find a business by its 6-digit Booklyt code (or scan its QR in the app) */}
      <div className="px-5 pt-4 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <FindByCode />
        </div>
        <ScanQrButton />
      </div>

      {/* Signed-in customer sections: upcoming, my businesses, favorites, book again */}
      {user && (
        <div className="pt-6">
          <Suspense fallback={<div className="h-24" />}>
            <HomeCustomerSections customerUserId={user.id} />
          </Suspense>
        </div>
      )}

      {/* Stats */}
      <Suspense fallback={<div className="h-24" />}>
        <StatsBar />
      </Suspense>

      {/* Categories */}
      <section className="px-5 pb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-zinc-900 text-base">Browse by category</h2>
          <Link href="/app/search" className="text-violet-600 text-xs font-medium flex items-center gap-0.5">
            All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <Suspense fallback={<div className="grid grid-cols-4 gap-2.5">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 p-2 animate-pulse">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100" />
              <div className="h-2.5 w-10 bg-zinc-100 rounded-full" />
            </div>
          ))}
        </div>}>
          <DynamicCategoryGrid />
        </Suspense>
      </section>

      {/* Nearby / Featured */}
      <section className="px-5 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-zinc-900 text-base">Featured businesses</h2>
          <Link href="/app/search" className="text-violet-600 text-xs font-medium flex items-center gap-0.5">
            See all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <Suspense fallback={
          <div className="grid grid-cols-2 gap-3">
            {Array(4).fill(0).map((_, i) => <BusinessCardSkeleton key={i} />)}
          </div>
        }>
          <NearbyBusinesses />
        </Suspense>
      </section>

      {/* Partner CTA */}
      <section className="mx-5 mb-6 rounded-3xl overflow-hidden bg-gradient-to-br from-violet-600 to-purple-700 p-5">
        <p className="text-violet-200 text-xs font-medium mb-1">For business owners</p>
        <h3 className="text-white text-lg font-bold leading-snug mb-3">
          Grow your business<br />with our platform
        </h3>
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 bg-white text-violet-700 text-sm font-bold px-4 py-2.5 rounded-xl"
        >
          Get started free <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>
    </div>
  )
}
