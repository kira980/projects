import { NextRequest, NextResponse } from 'next/server'
import { searchMarketplace } from '@/lib/marketplace/queries'
import type { MarketplaceSearchFilters } from '@/lib/marketplace/queries'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? undefined
  const sort = (searchParams.get('sort') ?? 'name') as MarketplaceSearchFilters['sort']

  const results = await searchMarketplace(q, { category, sort })
  return NextResponse.json({ results })
}
