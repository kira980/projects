"use client"

import { useState } from "react"
import { Loader2, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/components/ui/use-toast"

export function LogoutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false)
  async function logout() {
    if (loading) return
    setLoading(true)
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      window.location.assign("/")
    } catch (error) {
      toast({ variant: "destructive", title: "Could not log out", description: error instanceof Error ? error.message : "Please try again." })
      setLoading(false)
    }
  }
  return <button type="button" className={className} onClick={logout} disabled={loading} aria-busy={loading}>
    {loading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}<span>{loading ? "Logging out…" : "Log out"}</span>
  </button>
}
