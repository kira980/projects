import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Clock, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketplaceBusiness } from '@/lib/marketplace/queries'

interface BusinessCardProps {
  business: MarketplaceBusiness
  className?: string
  compact?: boolean
}

function formatPrice(price: number | null): string {
  if (price === null) return ''
  return `From $${price.toFixed(0)}`
}

function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function BusinessCard({ business, className, compact = false }: BusinessCardProps) {
  const { slug, displayName, category, address, logoUrl, coverUrl, primaryColor, minPrice } = business

  if (compact) {
    return (
      <Link
        href={`/app/business/${slug}`}
        className={cn(
          'flex items-center gap-3 p-3 rounded-2xl bg-white border border-zinc-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98]',
          className
        )}
      >
        <div
          className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-white font-bold text-sm"
          style={{ background: logoUrl ? undefined : primaryColor }}
        >
          {logoUrl ? (
            <Image src={logoUrl} alt={displayName} width={48} height={48} className="w-full h-full object-cover" />
          ) : (
            initials(displayName)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-900 text-sm truncate">{displayName}</p>
          <p className="text-xs text-zinc-400 capitalize truncate">{category}</p>
        </div>
        {minPrice !== null && (
          <span className="text-xs font-semibold text-zinc-500 flex-shrink-0">
            ${minPrice.toFixed(0)}+
          </span>
        )}
      </Link>
    )
  }

  return (
    <Link
      href={`/app/business/${slug}`}
      className={cn(
        'group flex flex-col rounded-2xl overflow-hidden bg-white shadow-sm border border-zinc-100 hover:shadow-lg transition-all duration-300 active:scale-[0.98]',
        className
      )}
    >
      {/* Cover image */}
      <div className="relative w-full h-40 bg-zinc-100 flex-shrink-0">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={displayName}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, 300px"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${primaryColor}30, ${primaryColor}10)` }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
              style={{ background: primaryColor }}
            >
              {initials(displayName)}
            </div>
          </div>
        )}
        {/* Category badge */}
        <span className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
          {category}
        </span>
        {/* Rating badge */}
        <span className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
          <Star className="w-2.5 h-2.5 fill-amber-400 stroke-amber-400" />
          4.9
        </span>
      </div>

      {/* Content */}
      <div className="p-3.5 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-zinc-900 text-sm leading-tight line-clamp-1">{displayName}</h3>
          {logoUrl && (
            <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-100">
              <Image src={logoUrl} alt={displayName} width={28} height={28} className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {address && (
          <div className="flex items-center gap-1 text-zinc-400">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="text-xs truncate">{address}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-1 pt-1 border-t border-zinc-50">
          <div className="flex items-center gap-1 text-zinc-400">
            <Clock className="w-3 h-3" />
            <span className="text-[11px]">Available today</span>
          </div>
          {minPrice !== null && (
            <span
              className="text-xs font-bold"
              style={{ color: primaryColor }}
            >
              {formatPrice(minPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// Skeleton loader
export function BusinessCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-zinc-100 animate-pulse">
        <div className="w-12 h-12 rounded-xl bg-zinc-100 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-zinc-100 rounded-full w-3/4" />
          <div className="h-2.5 bg-zinc-100 rounded-full w-1/2" />
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-zinc-100 animate-pulse">
      <div className="w-full h-40 bg-zinc-100" />
      <div className="p-3.5 space-y-2">
        <div className="h-4 bg-zinc-100 rounded-full w-3/4" />
        <div className="h-3 bg-zinc-100 rounded-full w-1/2" />
        <div className="h-3 bg-zinc-100 rounded-full w-2/3" />
      </div>
    </div>
  )
}
