'use client'

import { useState } from 'react'
import { Loader2, Megaphone } from 'lucide-react'
import { getDictionary, type Locale } from '@/lib/i18n'

interface Props {
  /** POST endpoint: /api/dashboard/announcements or /api/admin/portal/[slug]/announcements */
  endpoint: string
  language?: Locale
}

/** Compose + send a broadcast to the business's own customers (rate-limited server-side). */
export function AnnouncementComposer({ endpoint, language = 'en' }: Props) {
  const t = getDictionary(language).share
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? t.announceError)
      setResult(t.announceSent.replace('{count}', String(data.recipient_count ?? 0)))
      setTitle('')
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t.announceError)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Megaphone className="w-4 h-4 text-violet-600" />
        <p className="text-sm font-bold text-zinc-900">{t.announceTitle}</p>
      </div>
      <p className="text-xs text-zinc-400 mb-4">{t.announceSubtitle}</p>

      <form onSubmit={send} className="space-y-3">
        <input
          type="text"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.announceTitleField}
          className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <textarea
          required
          maxLength={500}
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t.announceBodyField}
          className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
        />
        {error && <p className="text-xs text-rose-600">{error}</p>}
        {result && <p className="text-xs font-medium text-emerald-600">{result}</p>}
        <button
          type="submit"
          disabled={sending || !title.trim() || !body.trim()}
          className="inline-flex items-center gap-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-2.5 rounded-xl transition-colors"
        >
          {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {t.announceSend}
        </button>
      </form>
    </div>
  )
}
