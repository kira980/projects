"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Keypad } from "./keypad";
import { Button } from "@/components/ui/button";
import { kioskLogin } from "./actions";

export function PasscodeScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(value: string) {
    setPending(true);
    const result = await kioskLogin(value);
    setPending(false);
    if (result.ok) {
      router.push("/workers/menu");
    } else {
      toast.error(result.error ?? "קוד שגוי");
      setCode("");
    }
  }

  function onDigit(d: string) {
    if (pending) return;
    const next = (code + d).slice(0, 4);
    setCode(next);
    // Auto-check once 4 digits are entered.
    if (next.length === 4) submit(next);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">אחראי משמרת</h1>
        <p className="mt-1 text-muted-foreground">הקישו קוד אישי לכניסה</p>
      </div>

      <div className="flex h-8 items-center gap-3" dir="ltr">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={`size-4 rounded-full border-2 transition-colors ${
              i < code.length
                ? "border-primary bg-primary"
                : "border-muted-foreground/50"
            }`}
          />
        ))}
      </div>

      <Keypad
        onDigit={onDigit}
        onBackspace={() => setCode((c) => c.slice(0, -1))}
        onClear={() => setCode("")}
        disabled={pending}
      />

      <Button
        size="lg"
        className="h-14 w-full max-w-xs text-lg"
        disabled={pending || code.length < 4}
        onClick={() => submit(code)}
      >
        {pending ? "בודק..." : "כניסה"}
      </Button>
    </main>
  );
}
