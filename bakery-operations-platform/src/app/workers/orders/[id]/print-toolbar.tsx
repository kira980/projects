"use client";

import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * `backHref` carries the day the print list was on, so closing a document
 * returns to that day's list rather than today's.
 */
export function PrintToolbar({ backHref = "/workers/orders" }: { backHref?: string }) {
  return (
    <div className="flex items-center justify-between print:hidden">
      <Button variant="ghost" asChild>
        <Link href={backHref}>
          <ArrowRight className="size-5" />
          חזרה
        </Link>
      </Button>
      <Button onClick={() => window.print()}>
        <Printer className="size-4" />
        הדפסה
      </Button>
    </div>
  );
}
