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

  const appName = business.app_name?.trim() || business.name
  const iconUrl = business.app_icon_url || business.logo_url || "/bookflow-icon.svg"
  const iconType = iconUrl.endsWith(".svg")
    ? "image/svg+xml"
    : iconUrl.includes(".png")
    ? "image/png"
    : "image/webp"
  const manifest = {
    id: `/book/${business.slug}`,
    name: appName,
    short_name: appName.slice(0, 24),
    description: business.description ?? `Book an appointment at ${business.name}`,
    start_url: `/book/${business.slug}`,
    scope: `/book/${business.slug}`,
    display_override: ["standalone", "minimal-ui"],
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#7c3aed",
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
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  })
}
