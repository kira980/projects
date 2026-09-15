import type { ReactNode } from 'react'
import { BottomNav } from '@/components/marketplace/BottomNav'

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
