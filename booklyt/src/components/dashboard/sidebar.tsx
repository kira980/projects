"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Calendar,
  LayoutDashboard,
  Scissors,
  Users,
  Clock,
  Settings,
  ExternalLink,
  ChevronDown,
  Building2,
  Palette,
  QrCode,
} from "lucide-react"
import { LogoutButton } from "@/components/auth/LogoutButton"
import { Business } from "@/types/database"
import { cn, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/appointments", label: "Appointments", icon: Calendar },
  { href: "/dashboard/services", label: "Services", icon: Scissors },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/hours", label: "Working Hours", icon: Clock },
  { href: "/dashboard/builder", label: "Website Builder", icon: Palette },
  { href: "/dashboard/share", label: "Share & App", icon: QrCode },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

interface SidebarProps {
  business: Business | null
  userName: string
  userEmail: string
  userAvatar?: string | null
}

export function Sidebar({ business, userName, userEmail, userAvatar }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <>
    <aside className="hidden lg:flex flex-col w-[230px] min-h-screen bg-white border-r border-zinc-100 shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-zinc-100">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <Calendar className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">BookFlow</span>
        </Link>
      </div>

      {/* Business selector */}
      {business && (
        <div className="px-3 py-3 border-b border-zinc-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-50 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                  {business.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={business.logo_url} alt={business.name} className="w-7 h-7 rounded-lg object-cover" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-violet-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-semibold truncate tracking-tight">{business.name}</p>
                  <p className="text-[11px] text-zinc-400 truncate capitalize">{business.category.replace("_", " ")}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem asChild>
                <Link href={`/book/${business.slug}`} target="_blank" className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  View booking page
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <Settings className="w-4 h-4" />
                  Business settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "sidebar-item",
                active ? "sidebar-item-active" : "sidebar-item-inactive"
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  active ? "text-violet-600" : "text-zinc-400"
                )}
              />
              <span className={cn("text-[13px]", active && "text-zinc-900")}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-zinc-100">
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarImage src={userAvatar ?? undefined} />
            <AvatarFallback className="text-[11px] bg-zinc-100 text-zinc-600">{getInitials(userName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-medium truncate tracking-tight">{userName}</p>
            <p className="text-[11px] text-zinc-400 truncate">{userEmail}</p>
          </div>
        </div>
        <LogoutButton className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100" />
      </div>
    </aside>

      {/* Mobile bottom nav — visible only on small screens */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-zinc-100 flex items-center gap-1 overflow-x-auto px-2 py-1 safe-area-pb">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-w-[64px] flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-colors',
                active ? 'text-violet-600' : 'text-zinc-400 hover:text-zinc-700'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold tracking-tight">{item.label.split(' ')[0]}</span>
            </Link>
          )
        })}
        <LogoutButton className="flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] text-zinc-600 hover:bg-zinc-100" />
      </nav>
    </>
  )
}
