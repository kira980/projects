"use client";

import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { logout } from "@/app/login/actions";

export function DashboardShell({
  businessName,
  userName,
  children,
}: {
  businessName: string;
  userName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh w-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground md:flex print:!hidden">
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-lg text-primary-foreground shadow-sm">
            🥖
          </span>
          <span className="truncate text-lg font-bold">{businessName}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <form action={logout} className="border-t border-sidebar-border p-3" autoComplete="off">
          <Button
            type="submit"
            variant="ghost"
            size="lg"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-5" />
            התנתקות
          </Button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-3 border-b bg-card px-4 print:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon" aria-label="פתיחת תפריט">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
              <SheetHeader className="border-b border-sidebar-border px-4 py-4">
                <SheetTitle className="flex items-center gap-2.5 text-lg">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-lg text-primary-foreground">
                    🥖
                  </span>
                  {businessName}
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto">
                <SidebarNav onNavigate={() => setOpen(false)} />
              </div>
              <form action={logout} className="border-t border-sidebar-border p-3" autoComplete="off">
                <Button
                  type="submit"
                  variant="ghost"
                  size="lg"
                  className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="size-5" />
                  התנתקות
                </Button>
              </form>
            </SheetContent>
          </Sheet>
          <span className="text-base font-semibold md:hidden">{businessName}</span>
          <div className="ms-auto text-[0.9375rem] text-muted-foreground">
            שלום, <span className="font-semibold text-foreground">{userName}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
