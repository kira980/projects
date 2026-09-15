'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Download, ExternalLink, QrCode, Share2, Smartphone } from 'lucide-react'
import { getDictionary, type Locale } from '@/lib/i18n'

export interface ShareAppCardProps {
  slug: string
  businessCode: string | null
  /** Absolute origin, e.g. https://booklyt.net (computed server-side). */
  origin: string
  language?: Locale
}

function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard unavailable (http / old WebView) — select-and-copy fallback
      window.prompt(label, value)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? copiedLabel : label}
    </button>
  )
}

function LinkRow({ label, value, copyLabel, copiedLabel }: { label: string; value: string; copyLabel: string; copiedLabel: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/60 px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
        <p className="text-xs font-medium text-zinc-700 truncate" dir="ltr">{value}</p>
      </div>
      <CopyButton value={value} label={copyLabel} copiedLabel={copiedLabel} />
    </div>
  )
}

/**
 * "Share & App" card used by both the owner dashboard and the admin portal:
 * business code, links (website / universal / deep), QR code with
 * download + native share, and an app preview link.
 */
export function ShareAppCard({ slug, businessCode, origin, language = 'en' }: ShareAppCardProps) {
  const t = getDictionary(language).share

  const websiteLink = `${origin}/book/${slug}`
  const appLink = businessCode ? `${origin}/app/business/${businessCode}` : null
  const deepLink = businessCode ? `booklyt://business/${businessCode}` : null
  const qrSrc = `/api/business/${slug}/qr`

  async function shareQr() {
    const shareData = {
      title: 'Booklyt',
      text: t.codeHint,
      url: appLink ?? websiteLink,
    }
    try {
      if (navigator.share) await navigator.share(shareData)
      else await navigator.clipboard.writeText(shareData.url)
    } catch {
      // user cancelled — nothing to do
    }
  }

  return (
    <div className="space-y-5">
      {/* Business code */}
      <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">{t.businessCode}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-4xl font-extrabold tracking-[0.25em] text-zinc-900" dir="ltr">
            {businessCode ?? '——————'}
          </p>
          {businessCode && <CopyButton value={businessCode} label={t.copy} copiedLabel={t.copied} />}
        </div>
        <p className="text-xs text-zinc-400 mt-2">{t.codeHint}</p>
      </div>

      {/* Links */}
      <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm space-y-2.5">
        <LinkRow label={t.websiteLink} value={websiteLink} copyLabel={t.copy} copiedLabel={t.copied} />
        {appLink && <LinkRow label={t.appLink} value={appLink} copyLabel={t.copy} copiedLabel={t.copied} />}
        {deepLink && <LinkRow label={t.deepLink} value={deepLink} copyLabel={t.copy} copiedLabel={t.copied} />}
        <Link
          href={`/app/${slug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 pt-1"
        >
          <Smartphone className="w-3.5 h-3.5" /> {t.previewApp} <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* QR */}
      {businessCode && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-bold text-zinc-900">{t.qrTitle}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt={`QR — ${slug}`}
              width={176}
              height={176}
              className="w-44 h-44 rounded-xl border border-zinc-100"
            />
            <div className="flex-1 space-y-2 w-full">
              <p className="text-xs text-zinc-400">{t.qrHint}</p>
              <div className="flex gap-2">
                <a
                  href={`${qrSrc}?download=1`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-2.5 rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> {t.download}
                </a>
                <button
                  type="button"
                  onClick={shareQr}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-3 py-2.5 rounded-xl transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" /> {t.shareButton}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
