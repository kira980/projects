"use client"

import { useState } from "react"
import { CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n"

export function ConfirmAttendanceButton({ token, language = "en" }: { token: string; language?: Locale }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmAttendance = async () => {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/appointment/confirm/${token}`, { method: "POST" })
    const result = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(result.error ?? "Could not confirm attendance. Please try again.")
    } else {
      setDone(true)
    }

    setLoading(false)
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        <CheckCircle className="h-4 w-4 shrink-0" />
        {language === "ar" ? "تم تأكيد حضورك!" : "Your attendance is confirmed!"}
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
        disabled={loading}
        onClick={confirmAttendance}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          language === "ar" ? "تأكيد حضوري" : "Confirm my attendance"
        )}
      </Button>
    </div>
  )
}
