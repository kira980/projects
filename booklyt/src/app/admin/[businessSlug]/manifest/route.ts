import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { Business } from "@/types/database"

interface RouteProps {
  params: Promise<{ businessSlug: string }>
}

export async function GET(_request: Request, { params }: RouteProps) {
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

  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const baseName = business.app_name?.trim() || business.name
  const appName = `${baseName} Admin`
  const iconUrl = business.app_icon_url || business.logo_url || "/bookflow-icon.svg"
  const iconType = iconUrl.endsWith(".svg")
    ? "image/svg+xml"
    : iconUrl.includes(".png")
    ? "image/png"
    : "image/webp"

  const manifest = {
    id: `/admin/${business.slug}`,
    name: appName,
    short_name: appName.slice(0, 24),
    description: business.description ?? `Manage bookings for ${business.name}`,
    start_url: `/admin/${business.slug}?source=pwa`,
    scope: `/admin/${business.slug}`,
    display_override: ["standalone", "minimal-ui"],
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f4f5",
    theme_color: "#18181b",
    icons: [
      {
        src: iconUrl,
        sizes: iconUrl.endsWith(".svg") ? "any" : "192x192",
        type: iconType,
        purpose: "any",
      },
      {
        src: iconUrl,
        sizes: iconUrl.endsWith(".svg") ? "any" : "512x512",
        type: iconType,
        purpose: "any",
      },
      {
        src: iconUrl,
        sizes: iconUrl.endsWith(".svg") ? "any" : "512x512",
        type: iconType,
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Appointments",
        short_name: "Bookings",
        url: `/admin/${business.slug}`,
      },
      {
        name: "Website Builder",
        short_name: "Builder",
        url: `/admin/${business.slug}/builder`,
      },
      {
        name: "Settings",
        short_name: "Settings",
        url: `/admin/${business.slug}/settings`,
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  })
}
