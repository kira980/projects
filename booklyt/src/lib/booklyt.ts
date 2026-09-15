/**
 * Booklyt platform identity — single source of truth for the customer app
 * brand, domain, and link formats used across web, QR codes, and native apps.
 */

const DEFAULT_DOMAIN = 'https://booklyt.net'

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_DOMAIN).replace(/\/+$/, '')
}

export const BOOKLYT = {
  appName: 'Booklyt',
  bundleId: 'com.booklyt.app',
  scheme: 'booklyt',

  get domain(): string {
    return baseUrl()
  },

  /** Public booking website for a business. */
  businessWebsiteLink(slug: string): string {
    return `${baseUrl()}/book/${slug}`
  },

  /** Universal link that opens the business mini-app (web or native app). */
  businessAppLink(code: string): string {
    return `${baseUrl()}/app/business/${code}`
  },

  /** Custom-scheme deep link for the native app. */
  businessDeepLink(code: string): string {
    return `booklyt://business/${code}`
  },
} as const

/** Business codes are 6-digit numeric strings. */
export const BUSINESS_CODE_REGEX = /^\d{6}$/
