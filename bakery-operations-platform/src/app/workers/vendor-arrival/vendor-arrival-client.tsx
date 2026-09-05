"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIdleLogout } from "../use-idle-logout";
import { kioskLogout } from "../actions";
import { submitVendorArrival } from "../vendor-actions";
import { VendorArrivalForm, type ArrivalVendor } from "./vendor-arrival-form";

export type { ArrivalVendor };

export function VendorArrivalClient({
  vendors,
  workers,
  currentWorkerId,
}: {
  vendors: ArrivalVendor[];
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
        <h1 className="text-2xl font-bold">קבלת סחורה</h1>
      </div>

      <VendorArrivalForm
        vendors={vendors}
        workers={workers}
        currentWorkerId={currentWorkerId}
        submitLabel="שמירה"
        action={submitVendorArrival}
        onSuccess={() => setTimeout(() => void kioskLogout(), 1500)}
      />
    </main>
  );
}
