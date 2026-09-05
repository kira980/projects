"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navGroups } from "./nav-items";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 p-3" aria-label="תפריט ראשי">
      {navGroups.map((group) => (
        <div key={group.label} className="grid gap-1">
          <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground/80 uppercase">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs ring-1 ring-sidebar-border"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "size-5 shrink-0",
                    active ? "text-sidebar-primary" : "text-muted-foreground"
                  )}
                  aria-hidden
                />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
