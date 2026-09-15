/**
 * Offline / error fallback shell.
 *
 * The real Booklyt app is the Next.js customer app loaded remotely via
 * capacitor.config.ts `server.url`. This screen only appears when that URL
 * fails to load (no connection, server down). "Try again" navigates the
 * WebView back to the server.
 */

import { useEffect, useState } from 'react'
import { BOOKLYT_CONFIG } from './config/booklyt'

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100dvh',
    padding: 24,
    background: '#fafafa',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    textAlign: 'center' as const,
    paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
    paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    background: BOOKLYT_CONFIG.brandColor,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 30,
    fontWeight: 800,
    marginBottom: 20,
    boxShadow: '0 8px 24px rgba(124,58,237,0.25)',
  },
  title: { fontSize: 20, fontWeight: 700, color: '#18181b', margin: 0 },
  body: { fontSize: 14, color: '#71717a', margin: '8px 0 24px', lineHeight: 1.5, maxWidth: 280 },
  button: {
    background: BOOKLYT_CONFIG.brandColor,
    color: '#fff',
    border: 'none',
    borderRadius: 16,
    padding: '14px 32px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    minWidth: 200,
  },
  spinner: {
    width: 18,
    height: 18,
    border: '2.5px solid rgba(255,255,255,0.35)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'bk-spin 0.8s linear infinite',
    verticalAlign: 'middle',
  },
}

export default function App() {
  const [retrying, setRetrying] = useState(false)

  const retry = () => {
    setRetrying(true)
    window.location.href = BOOKLYT_CONFIG.serverUrl
  }

  // Auto-retry when connectivity comes back
  useEffect(() => {
    const onOnline = () => retry()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  return (
    <div style={styles.root}>
      <style>{'@keyframes bk-spin { to { transform: rotate(360deg) } }'}</style>
      <div style={styles.logo}>B</div>
      <h1 style={styles.title}>You&apos;re offline</h1>
      <p style={styles.body}>
        Booklyt needs an internet connection. Check your connection and try again.
      </p>
      <button style={styles.button} onClick={retry} disabled={retrying}>
        {retrying ? <span style={styles.spinner} /> : 'Try again'}
      </button>
    </div>
  )
}
