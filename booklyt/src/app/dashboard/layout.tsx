import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/dashboard/sidebar"
import type { Profile, Business } from "@/types/database"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single() as { data: Profile | null; error: unknown }

  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle() as { data: Business | null; error: { message: string; code: string } | null }

  if (bizError) {
    console.error("[dashboard] businesses query error:", bizError.message, bizError.code)
  }

  if (!business) redirect("/onboarding")

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar
        business={business}
        userName={profile?.full_name ?? user.email ?? "User"}
        userEmail={user.email ?? ""}
        userAvatar={profile?.avatar_url}
      />
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  )
}
