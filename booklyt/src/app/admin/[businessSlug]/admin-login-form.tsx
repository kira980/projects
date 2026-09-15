"use client"

import { useState } from "react"
import { Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getDictionary, type Locale } from "@/lib/i18n"

export function AdminLoginForm({ slug, language = "en" }: { slug: string; language?: Locale }) {
  const t = getDictionary(language)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, password }),
    })
    const result = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(result.error ?? t.admin.couldNotSignIn)
      setLoading(false)
      return
    }

    window.location.reload()
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-1.5">
        <Label>{t.admin.adminPassword}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="pl-9"
            autoComplete="current-password"
          />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.admin.openAdminPage}
      </Button>
    </form>
  )
}
