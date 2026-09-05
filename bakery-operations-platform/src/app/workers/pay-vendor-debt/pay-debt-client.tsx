"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIdleLogout } from "../use-idle-logout";
import { kioskLogout } from "../actions";
import { submitVendorDebtPayment } from "../vendor-actions";
import {
  VendorPaymentForm,
  type PayableOrder,
  type VendorWithDebt,
} from "./vendor-payment-form";

export type { VendorWithDebt, PayableOrder as UnpaidOrder };

export function PayDebtClient({
  vendors,
  unpaidOrders,
  workers,
  currentWorkerId,
}: {
  vendors: VendorWithDebt[];
  unpaidOrders: PayableOrder[];
  workers: { id: string; full_name: string }[];
  currentWorkerId: string;
}) {
  useIdleLogout(120);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/workers/menu">
            <ArrowRight className="size-6" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">תשלום חוב לספק</h1>
      </div>

      <VendorPaymentForm
        vendors={vendors}
        payableOrders={unpaidOrders}
        workers={workers}
        currentWorkerId={currentWorkerId}
        submitLabel="אישור תשלום"
        action={submitVendorDebtPayment}
        onSuccess={() => setTimeout(() => void kioskLogout(), 1500)}
      />
    </main>
  );
}
