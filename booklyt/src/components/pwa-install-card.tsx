'use client'

import { useEffect, useState } from 'react'
import { Download, MoreVertical, Share, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface Props {
  appName: string
  iconUrl?: string | null
}

function isIos(userAgent: string) {
  return /iphone|ipad|ipod/i.test(userAgent)
}

function isAndroid(userAgent: string) {
  return /android/i.test(userAgent)
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari iOS exposes this non-standard flag.
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export function PwaInstallCard({ appName, iconUrl }: Props) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform, setPlatform] = useState<'android' | 'ios' | 'other'>('other')
  const [visible, setVisible] = useState(false)
  const [installPromptReady, setInstallPromptReady] = useState(false)

  useEffect(() => {
    const userAgent = window.navigator.userAgent
    const detectedPlatform = isIos(userAgent) ? 'ios' : isAndroid(userAgent) ? 'android' : 'other'
    setPlatform(detectedPlatform)

    if (isStandalone()) return
    if (window.localStorage.getItem(`pwa-install-dismissed:${appName}`) === '1') return

    if (detectedPlatform === 'ios') {
      setVisible(true)
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
      setInstallPromptReady(true)
      setVisible(true)
    }

    const handleInstalled = () => {
      setVisible(false)
      setPromptEvent(null)
      setInstallPromptReady(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    const fallbackTimer = detectedPlatform === 'android'
      ? window.setTimeout(() => {
          setVisible(true)
        }, 900)
      : undefined

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      if (fallbackTimer) window.clearTimeout(fallbackTimer)
    }
  }, [appName])

  const dismiss = () => {
    window.localStorage.setItem(`pwa-install-dismissed:${appName}`, '1')
    setVisible(false)
  }

  const installAndroid = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') {
      setVisible(false)
    }
    setPromptEvent(null)
    setInstallPromptReady(false)
  }

  if (!visible) return null
  if (platform === 'other') return null

  return (
    <div className="fixed inset-x-3 bottom-4 z-50 mx-auto max-w-sm rounded-2xl border border-black/10 bg-white p-4 shadow-[0_16px_60px_rgba(0,0,0,0.18)]">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex gap-3 pr-7">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconUrl} alt={appName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-400">
              {appName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-zinc-950">Install {appName}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
            Open this page from your home screen like an app.
          </p>
        </div>
      </div>

      {platform === 'android' ? (
        installPromptReady && promptEvent ? (
          <button
            type="button"
            onClick={installAndroid}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white"
          >
            <Download className="h-4 w-4" />
            Install app
          </button>
        ) : (
          <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600">
            <p className="font-semibold text-zinc-800">On Android:</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                Open this page in Chrome.
              </li>
              <li>
                Tap the <MoreVertical className="mx-0.5 inline h-3.5 w-3.5" /> menu.
              </li>
              <li>Choose <span className="font-semibold">Install app</span> or <span className="font-semibold">Add to Home screen</span>.</li>
            </ol>
            <p className="mt-2 text-[11px] text-zinc-500">
              If it only saves as a browser shortcut, open this page using HTTPS.
            </p>
          </div>
        )
      ) : (
        <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600">
          <p className="font-semibold text-zinc-800">On iPhone/iPad:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              Tap the <Share className="mx-0.5 inline h-3.5 w-3.5" /> Share button in Safari.
            </li>
            <li>Choose <span className="font-semibold">Add to Home Screen</span>.</li>
            <li>Tap <span className="font-semibold">Add</span>.</li>
          </ol>
        </div>
      )}
    </div>
  )
}
