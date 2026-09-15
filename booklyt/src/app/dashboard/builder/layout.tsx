'use client'

import { useEffect } from 'react'

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  // The builder needs full-screen. We hide the dashboard shell using CSS
  // and render the builder as a fixed overlay.
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 overflow-auto lg:overflow-hidden">
      {children}
    </div>
  )
}
