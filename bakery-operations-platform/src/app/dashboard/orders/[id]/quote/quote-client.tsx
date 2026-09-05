"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createQuoteSnapshot } from "./quote-actions";

export function QuoteToolbar({ orderId }: { orderId: string }) {
  const [pending, setPending] = useState(false);

  async function onRegenerate() {
    setPending(true);
    const result = await createQuoteSnapshot(orderId);
    setPending(false);
    if (result.ok) toast.success("נוצרה גרסה חדשה של הצעת המחיר");
    else toast.error(result.error ?? "שגיאה");
  }

  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <Button variant="ghost" size="icon" asChild aria-label="חזרה">
        <Link href={`/dashboard/orders/${orderId}`}>
          <ArrowRight className="size-5" />
        </Link>
      </Button>
      <h1 className="text-2xl font-bold">הצעת מחיר</h1>
      <div className="ms-auto flex gap-2">
        <Button variant="outline" disabled={pending} onClick={onRegenerate}>
          <RefreshCw className="size-4" />
          עדכון מההזמנה
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          הדפסה
        </Button>
      </div>
    </div>
  );
}
