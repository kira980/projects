"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  IosInstallSteps,
  useInstallPrompt,
  useInstalled,
  useIsIos,
} from "@/components/install-app-button";

/**
 * The full-page version of the install step: what the owner sends a worker
 * once their phone is registered. The compact button used elsewhere lives
 * in components/install-app-button.
 */
export function InstallClient() {
  const installed = useInstalled();
  const isIos = useIsIos();
  const [prompt, clear] = useInstallPrompt();
  const [busy, setBusy] = useState(false);

  async function onInstall() {
    if (!prompt) return;
    setBusy(true);
    await prompt.prompt();
    await prompt.userChoice;
    clear();
    setBusy(false);
  }

  if (installed) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6 text-center">
        <CheckCircle2 className="mx-auto size-16 text-success" aria-hidden />
        <h1 className="text-2xl font-bold">האפליקציה מותקנת</h1>
        <Button size="lg" className="h-16 text-lg" asChild>
          <Link href="/attendance">פתיחת הנוכחות</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6 text-center">
      <Download className="mx-auto size-16 text-primary" aria-hidden />
      <div>
        <h1 className="text-2xl font-bold">אפליקציית הנוכחות</h1>
        <p className="mt-2 text-muted-foreground">
          התקינו את האפליקציה בטלפון כדי להחתים כניסה ויציאה בלחיצה אחת.
        </p>
      </div>

      {isIos ? (
        // No install API on iOS — the steps are the only thing that works.
        <IosInstallSteps heading="שמירה למסך הבית" />
      ) : prompt ? (
        <Button
          size="lg"
          className="h-16 text-lg"
          disabled={busy}
          onClick={onInstall}
        >
          <Download className="size-6" />
          {busy ? "מתקין..." : "הורדת האפליקציה"}
        </Button>
      ) : (
        <div className="grid gap-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <p>
            אם כפתור ההתקנה לא מופיע, פתחו את התפריט של הדפדפן ובחרו
            &quot;התקנת אפליקציה&quot; או &quot;הוספה למסך הבית&quot;.
          </p>
        </div>
      )}

      <Button variant="ghost" asChild>
        <Link href="/attendance">המשך בלי להתקין</Link>
      </Button>
    </main>
  );
}
