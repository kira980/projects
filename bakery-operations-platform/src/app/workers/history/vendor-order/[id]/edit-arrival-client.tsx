"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIdleLogout } from "../../../use-idle-logout";
import {
  VendorArrivalForm,
  type ArrivalInitial,
  type ArrivalVendor,
} from "../../../vendor-arrival/vendor-arrival-form";
import { updateTodayVendorOrder } from "../../history-actions";

export function EditArrivalClient({
  orderId,
  vendors,
  workers,
  currentWorkerId,
  initial,
}: {
  orderId: string;
  vendors: ArrivalVendor[];
  workers: { id: string; full_name: string }[];
  currentWorkerId: string;
  initial: ArrivalInitial;
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
        <h1 className="text-2xl font-bold">עריכת קבלת סחורה</h1>
      </div>

      <VendorArrivalForm
        vendors={vendors}
        workers={workers}
        currentWorkerId={currentWorkerId}
        initial={initial}
        submitLabel="שמירת השינויים"
        action={(formData) => updateTodayVendorOrder(orderId, formData)}
        onSuccess={() => {
          router.push("/workers/history");
          router.refresh();
        }}
      />
    </main>
  );
}
