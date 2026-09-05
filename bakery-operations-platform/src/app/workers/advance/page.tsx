import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getWorkerSession } from "@/lib/kiosk/session";
import { Button } from "@/components/ui/button";
import { AdvanceClient } from "./advance-client";

export default async function AdvancePage() {
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");

  // Only shift managers may create advances.
  if (!session.canManageShift) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center gap-6 p-6">
        <div className="flex w-full items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="חזרה">
            <Link href="/workers/menu">
              <ArrowRight className="size-6" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">מפרעה</h1>
        </div>
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-center text-amber-900">
          רק אחראי משמרת יכול לרשום מפרעות. פנה לאחראי המשמרת.
        </p>
      </main>
    );
  }

  return <AdvanceClient managerName={session.name} />;
}
