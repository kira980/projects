'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Hash, ArrowRight, Loader2 } from 'lucide-react'

/**
 * "Find business" by 6-digit Booklyt code.
 * Navigates to /app/business/<code>, which resolves and opens the mini-app.
 */
export function FindByCode() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) return
    setLoading(true)
    router.push(`/app/business/${code}`)
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 bg-white border border-zinc-100 rounded-2xl px-3.5 py-2 shadow-sm">
      <Hash className="w-4 h-4 text-violet-500 flex-shrink-0" />
      <input
        type="text"
        inputMode="numeric"
        pattern="\d*"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="Enter business code"
        aria-label="Business code"
        className="flex-1 min-w-0 text-sm bg-transparent outline-none text-zinc-900 placeholder:text-zinc-400 tracking-widest font-semibold"
      />
      <button
        type="submit"
        disabled={code.length !== 6 || loading}
        aria-label="Open business"
        className="w-8 h-8 rounded-xl bg-violet-600 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
      </button>
    </form>
  )
}
