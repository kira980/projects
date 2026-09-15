'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import { BusinessCard, BusinessCardSkeleton } from '@/components/marketplace/BusinessCard'
import type { MarketplaceSearchResult, MarketplaceSearchFilters } from '@/lib/marketplace/queries'

const SORT_OPTIONS = [
  { value: 'name',       label: 'A–Z' },
  { value: 'price_asc',  label: 'Price: Low' },
  { value: 'price_desc', label: 'Price: High' },
] as const

const CATEGORY_OPTIONS = ['hair', 'nails', 'spa', 'barber', 'massage', 'makeup', 'lashes']

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQ = searchParams.get('q') ?? ''
  const initialCat = searchParams.get('category') ?? ''

  const [query, setQuery] = useState(initialQ)
  const [category, setCategory] = useState(initialCat)
  const [sort, setSort] = useState<MarketplaceSearchFilters['sort']>('name')
  const [showFilters, setShowFilters] = useState(false)
  const [results, setResults] = useState<MarketplaceSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const runSearch = useCallback(async (q: string, cat: string, s: MarketplaceSearchFilters['sort']) => {
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (cat) params.set('category', cat)
      if (s) params.set('sort', s)
      const res = await fetch(`/api/marketplace/search?${params}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Always load on mount — shows all businesses when no params
    runSearch(initialQ, initialCat, sort)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(query, category, sort)
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (category) params.set('category', category)
    router.replace(`/app/search?${params}`, { scroll: false })
  }

  return (
    <div>
      {/* Search bar */}
      <div className="bg-white sticky top-0 z-20 border-b border-zinc-100 px-4 pt-12 pb-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-zinc-100 rounded-2xl px-3.5 py-2.5">
          <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search businesses, services..."
            className="flex-1 text-sm bg-transparent outline-none text-zinc-900 placeholder:text-zinc-400"
            enterKeyHint="search"
            autoFocus={!initialQ}
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults([]); setSearched(false) }}>
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          )}
        </form>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mt-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1 text-xs font-medium text-zinc-600 bg-zinc-100 px-3 py-1.5 rounded-full flex-shrink-0"
          >
            <SlidersHorizontal className="w-3 h-3" />
            Filters
          </button>
          {CATEGORY_OPTIONS.map(cat => (
            <button
              key={cat}
              onClick={() => {
                const next = category === cat ? '' : cat
                setCategory(next)
                runSearch(query, next, sort)
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full flex-shrink-0 capitalize transition-colors ${
                category === cat
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        {showFilters && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-zinc-500">Sort:</span>
            <div className="relative">
              <select
                value={sort}
                onChange={e => {
                  const s = e.target.value as MarketplaceSearchFilters['sort']
                  setSort(s)
                  runSearch(query, category, s)
                }}
                className="appearance-none text-xs bg-zinc-100 text-zinc-700 font-medium pr-6 pl-3 py-1.5 rounded-full outline-none"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="p-4">
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {Array(6).fill(0).map((_, i) => <BusinessCardSkeleton key={i} />)}
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-16 text-zinc-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-zinc-600">No results found</p>
            <p className="text-sm mt-1">Try a different search or browse categories</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <p className="text-xs text-zinc-400 mb-3">{results.length} result{results.length !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-2 gap-3">
              {results.map(biz => (
                <BusinessCard key={biz.id} business={biz} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <SearchContent />
    </Suspense>
  )
}
