import type { Metadata, Viewport } from "next"
import { createClient } from "@/lib/supabase/server"
import type { Business } from "@/types/database"

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ businessSlug: string }>
}

export const viewport: Viewport = {
  themeColor: "#18181b",
  viewportFit: "cover",
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { businessSlug } = await params
  const supabase = await createClient()
  const { data: business } = await supabase
    .from("businesses")
    .select("name, slug, description, app_name, app_icon_url, logo_url")
    .eq("slug", businessSlug)
    .single() as {
      data: Pick<Business, "name" | "slug" | "description" | "app_name" | "app_icon_url" | "logo_url"> | null
      error: unknown
    }

  if (!business) return { title: "Admin" }

  const baseName = business.app_name?.trim() || business.name
  const appName = `${baseName} Admin`
  const iconUrl = business.app_icon_url || business.logo_url || "/bookflow-icon.svg"

  return {
    title: `${business.name} Admin`,
    applicationName: appName,
    description: business.description ?? `Manage bookings for ${business.name}`,
    manifest: `/admin/${business.slug}/manifest`,
    appleWebApp: {
      capable: true,
      title: appName,
      statusBarStyle: "black-translucent",
    },
    icons: {
      icon: [{ url: iconUrl, sizes: iconUrl.endsWith(".svg") ? "any" : "512x512" }],
      apple: [{ url: iconUrl, sizes: iconUrl.endsWith(".svg") ? "any" : "512x512" }],
    },
  }
}

export default function AdminBusinessLayout({ children }: LayoutProps) {
  return children
}
