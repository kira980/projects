"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { quotationFilename } from "@/lib/deliveries/public-id";

/**
 * Download/print controls for the delivery quotation. Uses the browser's
 * native print-to-PDF, which renders Hebrew/Arabic RTL correctly and needs
 * no server-side font embedding. Setting document.title makes the saved
 * file default to "quotation-<DELIVERY_ID>.pdf".
 */
export function QuoteToolbar({
  orderId,
  deliveryId,
  orderNumber,
}: {
  orderId: string;
  deliveryId: string | null;
  orderNumber: number;
}) {
  const filename = quotationFilename(deliveryId, orderNumber);

  useEffect(() => {
    const prev = document.title;
    document.title = filename;
    return () => {
      document.title = prev;
    };
  }, [filename]);

  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <Button variant="ghost" size="icon" asChild aria-label="חזרה">
        <Link href={`/dashboard/deliveries/${orderId}`}>
          <ArrowRight className="size-5" />
        </Link>
      </Button>
      <h1 className="text-2xl font-bold">הצעת מחיר</h1>
      <div className="ms-auto flex gap-2">
        <Button variant="outline" onClick={() => window.print()}>
          <Download className="size-4" />
          הורדת PDF
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          הדפסה
        </Button>
      </div>
    </div>
  );
}
