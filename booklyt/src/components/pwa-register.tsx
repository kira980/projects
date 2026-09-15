'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then(registration => {
      registration.update().catch(() => {})
    }).catch(error => {
      console.warn('Service worker registration failed', error)
    })
  }, [])

  return null
}
