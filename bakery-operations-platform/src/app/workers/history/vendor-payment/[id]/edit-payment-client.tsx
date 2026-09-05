"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIdleLogout } from "../../../use-idle-logout";
import {
  VendorPaymentForm,
  type PayableOrder,
  type PaymentInitial,
  type VendorWithDebt,
} from "../../../pay-vendor-debt/vendor-payment-form";
import { updateTodayVendorPayment } from "../../history-actions";

export function EditPaymentClient({
  paymentId,
  vendors,
  payableOrders,
  workers,
  currentWorkerId,
  initial,
}: {
  paymentId: string;
  vendors: VendorWithDebt[];
  payableOrders: PayableOrder[];
  workers: { id: string; full_name: string }[];
  currentWorkerId: string;
  initial: PaymentInitial;
}) {
  useIdleLogout(120);
  const router = useRouter();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/workers/history">
            <ArrowRight className="size-6" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">עריכת תשלום לספק</h1>
      </div>

      <VendorPaymentForm
        vendors={vendors}
        payableOrders={payableOrders}
        workers={workers}
        currentWorkerId={currentWorkerId}
        initial={initial}
        submitLabel="שמירת השינויים"
        action={(formData) => updateTodayVendorPayment(paymentId, formData)}
        onSuccess={() => {
          router.push("/workers/history");
          router.refresh();
        }}
      />
    </main>
  );
}
