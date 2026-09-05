"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Keypad } from "../keypad";
import { useIdleLogout } from "../use-idle-logout";
import {
  giveAdvance,
  getAdvanceWorkers,
  kioskLogout,
  type AdvanceWorker,
} from "../actions";

type Step = "worker" | "amount";

export function AdvanceClient({ managerName }: { managerName: string }) {
  useIdleLogout(30);
  const [step, setStep] = useState<Step>("worker");
  const [allWorkers, setAllWorkers] = useState<AdvanceWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [worker, setWorker] = useState<AdvanceWorker | null>(null);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getAdvanceWorkers().then((r) => {
      if (r.ok) {
        setAllWorkers(r.allWorkers ?? []);
      } else {
        toast.error(r.error ?? "שגיאה");
      }
      setLoading(false);
    });
  }, []);

  function pick(w: AdvanceWorker) {
    setWorker(w);
    setStep("amount");
  }

  async function submit() {
    if (!worker) return;
    setPending(true);
    // Advances are always cash — no payment-method question.
    const result = await giveAdvance(
      worker.id,
      Number(amount),
      worker.on_shift ? "shift" : "other"
    );
    if (result.ok) {
      toast.success(result.info);
      setTimeout(() => void kioskLogout(), 1500);
    } else {
      toast.error(result.error ?? "שגיאה");
      setPending(false);
    }
  }

  const results = query
    ? allWorkers.filter((w) => w.full_name.includes(query))
    : allWorkers;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center gap-6 p-6">
      <div className="flex w-full items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="חזרה"
          onClick={() => {
            if (step === "amount") {
              setStep("worker");
              setWorker(null);
              setAmount("");
            }
          }}
          asChild={step === "worker"}
        >
          {step === "worker" ? (
            <Link href="/workers/menu">
              <ArrowRight className="size-6" />
            </Link>
          ) : (
            <ArrowRight className="size-6" />
          )}
        </Button>
        <div>
          <h1 className="text-2xl font-bold">מפרעה</h1>
          <p className="text-sm text-muted-foreground">אחראי משמרת: {managerName}</p>
        </div>
      </div>

      {step === "worker" && (
        <div className="grid w-full gap-3">
          {loading && <p className="text-center text-muted-foreground">טוען עובדים...</p>}

          {!loading && (
            <>
              <div className="flex items-center gap-2">
                <Search className="size-5 text-muted-foreground" />
                <Input
                  placeholder="חיפוש עובד..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div className="grid gap-2">
                {results.map((w) => (
                  <Button
                    key={w.id}
                    variant="outline"
                    className="h-14 justify-between text-base"
                    onClick={() => pick(w)}
                  >
                    <span>{w.full_name}</span>
                    {w.on_shift && (
                      <span className="text-xs text-muted-foreground">במשמרת</span>
                    )}
                  </Button>
                ))}
                {results.length === 0 && (
                  <p className="py-4 text-center text-muted-foreground">לא נמצאו עובדים</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {step === "amount" && worker && (
        <>
          <div className="w-full rounded-lg border bg-card p-3 text-center">
            <span className="text-lg font-semibold">{worker.full_name}</span>
            <span className="ms-2 text-sm text-muted-foreground">
              {worker.on_shift ? "(במשמרת)" : "(לא במשמרת)"}
            </span>
          </div>

          <div className="flex h-16 items-center justify-center text-5xl font-bold" dir="ltr">
            {amount ? `₪${Number(amount).toLocaleString()}` : "₪0"}
          </div>

          <Keypad
            onDigit={(d) =>
              setAmount((a) => (a + d).replace(/^0+/, "").slice(0, 5) || "0")
            }
            onBackspace={() => setAmount((a) => a.slice(0, -1))}
            onClear={() => setAmount("")}
            disabled={pending}
          />

          <Button
            size="lg"
            className="h-16 w-full max-w-xs bg-green-600 text-lg text-white hover:bg-green-700"
            disabled={pending || !amount || Number(amount) <= 0}
            onClick={submit}
          >
            {pending ? "שומר..." : "אישור מפרעה (מזומן)"}
          </Button>
        </>
      )}
    </main>
  );
}
