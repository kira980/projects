"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Adding one of this app's screens to the home screen.
 *
 * Each PWA scope here (/attendance, /secret, /workers …) has its own
 * manifest, so whichever one the browser is showing is the one that gets
 * installed — the button does not need to know which app it is in.
 */

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Already on the home screen? Read from the display mode, live. */
export function useInstalled(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(display-mode: standalone)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari predates the standard and reports it here instead.
      (window.navigator as { standalone?: boolean }).standalone === true,
    () => false
  );
}

export function useIsIos(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => /iphone|ipad|ipod/i.test(window.navigator.userAgent),
    () => false
  );
}

/**
 * The browser's install prompt, held until a real user gesture can raise
 * it. Null when the browser has not offered one — iOS never does.
 */
export function useInstallPrompt(): [InstallPrompt | null, () => void] {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    function onAvailable(e: Event) {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    }
    function onInstalled() {
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onAvailable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onAvailable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return [prompt, () => setPrompt(null)];
}

/**
 * The iOS recipe, which is the only route Safari offers — there is no
 * install API on iOS, so nothing can be triggered from a button.
 */
export function IosInstallSteps({ heading }: { heading?: string }) {
  return (
    <div className="grid gap-2 rounded-lg border bg-card p-3 text-start">
      {heading && (
        <p className="flex items-center gap-2 font-medium">
          <Share className="size-4 shrink-0 text-primary" aria-hidden />
          {heading}
        </p>
      )}
      <ol className="grid gap-2 text-sm">
        <li className="flex items-center gap-2">
          <Share className="size-4 shrink-0 text-primary" aria-hidden />
          לחצו על כפתור השיתוף בדפדפן
        </li>
        <li className="flex items-center gap-2">
          <Plus className="size-4 shrink-0 text-primary" aria-hidden />
          בחרו &quot;הוספה למסך הבית&quot;
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
          אשרו — האפליקציה תופיע במסך הבית
        </li>
      </ol>
    </div>
  );
}

/**
 * Compact install control, which is a different thing on each platform.
 *
 * Android and the desktop browsers expose an install prompt, so there the
 * button really does put the app on the device. iOS has no such API, so a
 * button would be a lie that does nothing when tapped — there the steps
 * are shown outright instead. Once the app is installed, neither appears.
 */
export function InstallAppButton({
  label = "הורדת האפליקציה",
}: {
  label?: string;
}) {
  const installed = useInstalled();
  const isIos = useIsIos();
  const [prompt, clear] = useInstallPrompt();
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);

  if (installed) return null;

  // iPhone / iPad: no prompt exists, so lead with the recipe.
  if (isIos) return <IosInstallSteps heading="שמירה למסך הבית" />;

  async function onInstall() {
    if (!prompt) {
      // The browser has not offered a prompt (already dismissed, or its
      // heuristics have not fired). Point at the menu that always works.
      setShowHint((v) => !v);
      return;
    }
    setBusy(true);
    await prompt.prompt();
    await prompt.userChoice;
    clear();
    setBusy(false);
  }

  return (
    <div className="grid gap-2">
      <Button variant="outline" disabled={busy} onClick={onInstall}>
        <Download className="size-4" />
        {busy ? "מתקין..." : label}
      </Button>
      {showHint && (
        <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
          פתחו את תפריט הדפדפן ובחרו &quot;התקנת אפליקציה&quot; או
          &quot;הוספה למסך הבית&quot;.
        </p>
      )}
    </div>
  );
}
