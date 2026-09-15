'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    try {
      await fetch('/api/customer/auth/logout', { method: 'POST' })
    } finally {
      router.refresh()
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="flex items-center gap-3 w-full bg-white border border-zinc-100 rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] text-left"
    >
      <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
        {loading ? <Loader2 className="w-4.5 h-4.5 text-rose-500 animate-spin" /> : <LogOut className="w-4.5 h-4.5 text-rose-500" />}
      </div>
      <span className="flex-1 font-medium text-rose-600 text-sm">Sign out</span>
    </button>
  )
}
