/**
 * Booklyt Mobile — platform configuration.
 * Single source of truth for the native shell identity and server URL.
 *
 * The native apps load the Booklyt customer app (Next.js, /app routes)
 * directly from the server. This bundled Vite shell is only shown when the
 * server can't be reached (offline / error fallback).
 *
 * ── Development ──────────────────────────────────────────────────────────────
 * Point the native WebView at your local Next.js server when syncing:
 *   CAP_SERVER_URL=http://<your-lan-ip>:3000/app npx cap sync
 *
 * ── Production ───────────────────────────────────────────────────────────────
 * No env needed — defaults to https://booklyt.net/app
 */

export const BOOKLYT_CONFIG = {
  appId: 'com.booklyt.app',
  appName: 'Booklyt',

  /** Where the real app lives. */
  serverUrl: 'https://booklyt.net/app',

  brandColor: '#7c3aed',
  deepLinkScheme: 'booklyt',
  webDomain: 'booklyt.net',
  supportEmail: 'support@booklyt.net',
} as const

export type BooklytConfig = typeof BOOKLYT_CONFIG
