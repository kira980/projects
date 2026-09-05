"use client";

import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DocToolbar({ orderId, title }: { orderId: string; title: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <Button variant="ghost" size="icon" asChild aria-label="חזרה">
        <Link href={`/dashboard/orders/${orderId}`}>
          <ArrowRight className="size-5" />
        </Link>
      </Button>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="ms-auto flex gap-2">
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          הדפסה
        </Button>
      </div>
    </div>
  );
}
