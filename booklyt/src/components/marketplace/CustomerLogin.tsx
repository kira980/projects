'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Phone, ShieldCheck } from 'lucide-react'

/**
 * Passwordless WhatsApp-OTP sign-in for the Booklyt customer app.
 * Reuses the existing customer auth APIs (purpose "booking" = find-or-create,
 * OTP is the sole credential), so it works for new and returning customers.
 */
export function CustomerLogin({ title = 'Sign in to Booklyt' }: { title?: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/customer/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'booking' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to send code')
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/customer/auth/otp/verify-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, ...(fullName.trim() ? { full_name: fullName.trim() } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Invalid code')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-zinc-100 rounded-3xl p-6 shadow-sm">
      <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
        {step === 'phone'
          ? <Phone className="w-5.5 h-5.5 text-violet-600" />
          : <ShieldCheck className="w-5.5 h-5.5 text-violet-600" />}
      </div>
      <h2 className="text-lg font-bold text-zinc-900 mb-1">{title}</h2>
      <p className="text-sm text-zinc-400 mb-5">
        {step === 'phone'
          ? 'We’ll send a verification code to your WhatsApp.'
          : `Enter the code we sent to ${phone} on WhatsApp.`}
      </p>

      {step === 'phone' ? (
        <form onSubmit={sendCode} className="space-y-3">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <input
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || phone.trim().length < 7}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold rounded-2xl px-4 py-3.5 text-sm transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Send code
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="Verification code"
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3.5 text-sm tracking-[0.4em] text-center font-bold focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length < 4}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold rounded-2xl px-4 py-3.5 text-sm transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Verify & sign in
          </button>
          <button
            type="button"
            onClick={() => { setStep('phone'); setCode(''); setError(null) }}
            className="w-full text-sm text-zinc-400 hover:text-zinc-600 py-1"
          >
            Use a different number
          </button>
        </form>
      )}
    </div>
  )
}
