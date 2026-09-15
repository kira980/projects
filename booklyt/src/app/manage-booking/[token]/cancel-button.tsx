"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDictionary, type Locale } from "@/lib/i18n"

export function CancelBookingButton({ token, language = "en" }: { token: string; language?: Locale }) {
  const t = getDictionary(language)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancelBooking = async () => {
    if (!confirm(t.manageBooking.cancelConfirm)) return

    setLoading(true)
    setError(null)

    const res = await fetch("/api/book/manage/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    const result = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(result.error ?? t.manageBooking.cancelError)
    } else {
      setDone(true)
    }

    setLoading(false)
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        {t.manageBooking.cancelledDone}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <Button
        type="button"
        variant="destructive"
        disabled={loading}
        onClick={cancelBooking}
        className="w-full"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.manageBooking.cancelButton}
      </Button>
    </div>
  )
}
