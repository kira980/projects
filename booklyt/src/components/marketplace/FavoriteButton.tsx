'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'

interface Props {
  businessId: string
  initialFavorite: boolean
  className?: string
}

/** Optimistic favorite toggle for a saved business. */
export function FavoriteButton({ businessId, initialFavorite, className }: Props) {
  const [favorite, setFavorite] = useState(initialFavorite)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const next = !favorite
    setFavorite(next)
    try {
      const res = await fetch('/api/customer/businesses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, favorite: next }),
      })
      if (!res.ok) setFavorite(!next)
    } catch {
      setFavorite(!next)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={favorite}
      className={className ?? 'p-2 rounded-xl hover:bg-zinc-100 active:scale-90 transition-transform'}
    >
      <Heart
        className={`w-5 h-5 transition-colors ${favorite ? 'fill-rose-500 text-rose-500' : 'text-zinc-400'}`}
      />
    </button>
  )
}
