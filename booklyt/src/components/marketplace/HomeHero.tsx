'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin } from 'lucide-react'

export function HomeHero() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q) router.push(`/app/search?q=${encodeURIComponent(q)}`)
    else router.push('/app/search')
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 px-5 pt-14 pb-10">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-purple-500/30 blur-3xl" />

      <div className="relative z-10 max-w-lg mx-auto">
        <p className="text-violet-200 text-sm font-medium mb-1">Discover & Book</p>
        <h1 className="text-white text-3xl font-extrabold leading-tight mb-2">
          Find the best<br />services near you
        </h1>
        <div className="flex items-center gap-1 text-violet-200 text-xs mb-6">
          <MapPin className="w-3.5 h-3.5" />
          <span>All locations</span>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <div className="flex items-center gap-2 bg-white rounded-2xl shadow-xl shadow-violet-900/30 px-4 py-3">
            <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search salons, spas, barbers..."
              className="flex-1 text-sm text-zinc-900 placeholder:text-zinc-400 bg-transparent outline-none"
              enterKeyHint="search"
            />
            <button
              type="submit"
              className="bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors"
            >
              Search
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
