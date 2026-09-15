'use client'

import { useEffect } from 'react'
import type { BrandConfig } from '@/types/builder'

interface Props {
  brand: BrandConfig
  children: React.ReactNode
}

export function TenantThemeProvider({ brand, children }: Props) {
  // Choose the more legible text colour for the tenant's button background.
  const hex = brand.primaryColor.replace('#', '')
  const fullHex = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex
  const channels = /^[0-9a-f]{6}$/i.test(fullHex)
    ? [0, 2, 4].map(offset => parseInt(fullHex.slice(offset, offset + 2), 16) / 255)
    : [0, 0, 0]
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2]
  const onPrimary = luminance > .179 ? '#000000' : '#ffffff'

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--tenant-primary',     brand.primaryColor)
    root.style.setProperty('--tenant-accent',      brand.accentColor)
    root.style.setProperty('--tenant-background',  brand.backgroundColor)
    root.style.setProperty('--tenant-surface',     brand.surfaceColor)
    root.style.setProperty('--tenant-text',        brand.textColor)
    root.style.setProperty('--tenant-muted',       brand.mutedColor)
    root.style.setProperty('--tenant-radius',           brand.radius)
    root.style.setProperty('--tenant-card-radius',      `calc(${brand.radius} + 4px)`)
    root.style.setProperty('--tenant-calendar-text',    brand.calendarTextColor ?? '#ffffff')
    root.style.setProperty('--tenant-heading-font',     `'${brand.font}', serif`)

    if (brand.font && !['Inter', 'system-ui'].includes(brand.font)) {
      const fontSlug = brand.font.replace(/ /g, '+')
      if (!document.querySelector(`link[data-font="${fontSlug}"]`)) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.dataset.font = fontSlug
        link.href = `https://fonts.googleapis.com/css2?family=${fontSlug}:wght@300;400;500;600;700&display=swap`
        document.head.appendChild(link)
      }
    }
  }, [brand])

  // CSS custom properties aren't in React.CSSProperties — cast the object once
  const vars = {
    '--tenant-primary':          brand.primaryColor,
    '--tenant-on-primary':       onPrimary,
    '--tenant-accent':           brand.accentColor,
    '--tenant-background':       brand.backgroundColor,
    '--tenant-surface':          brand.surfaceColor,
    '--tenant-text':             brand.textColor,
    '--tenant-muted':            brand.mutedColor,
    '--tenant-radius':           brand.radius,
    '--tenant-card-radius':      `calc(${brand.radius} + 4px)`,
    '--tenant-calendar-text':    brand.calendarTextColor ?? '#ffffff',
    '--tenant-heading-font':     `'${brand.font}', serif`,
    fontFamily:                  'var(--font-geist-sans), system-ui, sans-serif',
    backgroundColor:             brand.backgroundColor,
    color:                       brand.textColor,
  } as React.CSSProperties

  return (
    <div style={vars} className="tenant-root">
      {children}
    </div>
  )
}
