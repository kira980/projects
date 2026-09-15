import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { ArrowLeft } from 'lucide-react'
import { getBusinessBySlug } from '@/lib/marketplace/queries'
import { BookingFlow } from '@/components/booking/booking-flow'
import { TenantThemeProvider } from '@/components/theme/TenantThemeProvider'
import { CUSTOMER_AUTH_COOKIE, getUserFromToken } from '@/lib/customer-auth'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ businessSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { businessSlug } = await params
  const biz = await getBusinessBySlug(businessSlug)
  if (!biz) return { title: 'Book appointment' }
  return { title: `Book at ${biz.displayName}` }
}

export default async function BookPage({ params }: Props) {
  const { businessSlug } = await params
  const biz = await getBusinessBySlug(businessSlug)
  if (!biz) notFound()

  const pub = biz.publishedConfig

  const cookieStore = await cookies()
  const authToken = cookieStore.get(CUSTOMER_AUTH_COOKIE)?.value
  const currentCustomerUser = authToken ? await getUserFromToken(authToken) : null

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-zinc-100">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          <Link href={`/app/business/${businessSlug}`} className="p-1.5 rounded-xl hover:bg-zinc-100 flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-zinc-700" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {biz.logoUrl && (
              <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
                <Image src={biz.logoUrl} alt={biz.displayName} width={28} height={28} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-zinc-900 text-sm truncate">{biz.displayName}</p>
              <p className="text-[10px] text-zinc-400">Book an appointment</p>
            </div>
          </div>
        </div>
      </div>

      {/* Booking flow */}
      <div className="max-w-lg mx-auto px-0">
        {pub ? (
          <TenantThemeProvider brand={pub.brand}>
            <BookingFlow
              business={biz.business}
              services={biz.services}
              categories={biz.categories}
              staff={biz.staff}
              staffServices={biz.staffServices}
              workingHours={biz.workingHours}
              brandColor={pub.brand.primaryColor}
              brandRadius={pub.brand.radius}
              forceMobileLayout
              currentCustomerUser={currentCustomerUser}
            />
          </TenantThemeProvider>
        ) : (
          <BookingFlow
            business={biz.business}
            services={biz.services}
            categories={biz.categories}
            staff={biz.staff}
            staffServices={biz.staffServices}
            workingHours={biz.workingHours}
            brandColor={biz.primaryColor}
            forceMobileLayout
            currentCustomerUser={currentCustomerUser}
          />
        )}
      </div>
    </div>
  )
}
