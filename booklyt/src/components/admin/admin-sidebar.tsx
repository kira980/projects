"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  Calendar,
  Clock,
  ExternalLink,
  LayoutDashboard,
  Palette,
  Scissors,
  Settings,
  Users,
  History,
  Building2,
  QrCode,
} from "lucide-react"
import type { Business } from "@/types/database"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, getInitials } from "@/lib/utils"
import { getDictionary } from "@/lib/i18n"

const adminNavItems = [
  { tab: "overview", labelKey: "overview", icon: LayoutDashboard },
  { tab: "appointments", labelKey: "appointments", icon: Calendar },
  { tab: "services", labelKey: "services", icon: Scissors },
  { tab: "staff", labelKey: "staff", icon: Users },
  { tab: "hours", labelKey: "workingHours", icon: Clock },
  { tab: "history", labelKey: "history", icon: History },
] as const

interface AdminSidebarProps {
  business: Business
}

export function AdminSidebar({ business }: AdminSidebarProps) {
  const t = getDictionary(business.language)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get("tab") || "overview"
  const adminBase = `/admin/${business.slug}`

  const adminLinks = [
    ...adminNavItems.map(item => ({
      href: `${adminBase}?tab=${item.tab}`,
      label: item.labelKey === "overview"
        ? t.admin.overview
        : item.labelKey === "appointments"
        ? t.admin.appointments
        : t.common[item.labelKey],
      icon: item.icon,
      active: pathname === adminBase && activeTab === item.tab,
    })),
    {
      href: `${adminBase}/builder`,
      label: t.admin.websiteBuilder,
      icon: Palette,
      active: pathname.startsWith(`${adminBase}/builder`),
    },
    {
      href: `${adminBase}/share`,
      label: t.share.title,
      icon: QrCode,
      active: pathname.startsWith(`${adminBase}/share`),
    },
    {
      href: `${adminBase}/settings`,
      label: t.common.settings,
      icon: Settings,
      active: pathname.startsWith(`${adminBase}/settings`),
    },
  ]

  return (
    <>
      <aside className="hidden lg:flex flex-col w-[230px] min-h-screen bg-white border-r border-zinc-100 shrink-0">
        <div className="h-14 flex items-center px-5 border-b border-zinc-100">
          <Link href={adminBase} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">BookFlow</span>
          </Link>
        </div>

        <div className="px-3 py-3 border-b border-zinc-100">
          <div className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 overflow-hidden">
              {business.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logo_url} alt={business.name} className="w-7 h-7 rounded-lg object-cover" />
              ) : (
                <Building2 className="w-3.5 h-3.5 text-violet-600" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-start">
              <p className="text-[13px] font-semibold truncate tracking-tight">{business.name}</p>
              <p className="text-[11px] text-zinc-400 truncate capitalize">{business.category.replace("_", " ")}</p>
            </div>
          </div>
          <Link
            href={`/book/${business.slug}`}
            target="_blank"
            className="mt-2 flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t.admin.viewBookingPage}
          </Link>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {adminLinks.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn("sidebar-item", item.active ? "sidebar-item-active" : "sidebar-item-inactive")}
            >
              <item.icon className={cn("w-4 h-4 shrink-0", item.active ? "text-violet-600" : "text-zinc-400")} />
              <span className={cn("text-[13px]", item.active && "text-zinc-900")}>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-zinc-100">
          <div className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarImage src={business.logo_url ?? undefined} />
              <AvatarFallback className="text-[11px] bg-zinc-100 text-zinc-600">
                {getInitials(business.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-start">
              <p className="text-[13px] font-medium truncate tracking-tight">{t.common.businessAdmin}</p>
              <p className="text-[11px] text-zinc-400 truncate">{t.admin.sharedAccess}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Top safe area bar — pushes content below iOS status bar in PWA mode */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-50 bg-zinc-950" style={{ height: 'calc(env(safe-area-inset-top) + 10px)' }} />

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-zinc-100 flex items-center gap-1 overflow-x-auto px-2 py-1 safe-area-pb">
        {adminLinks.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-w-[64px] flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-colors",
              item.active ? "text-violet-600" : "text-zinc-400 hover:text-zinc-700"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-tight">{item.label.split(" ")[0]}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
