"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Chrome fires `beforeinstallprompt` only when the app meets the full
 * installability criteria (HTTPS + valid manifest + a service worker with a
 * fetch handler). We capture that event and surface our own "Install app"
 * button, giving a real one-tap install on Android instead of the manual
 * "Add to Home Screen" flow.
 *
 * The event can fire *before* React hydrates — especially on pages the user
 * reaches with high engagement (e.g. the production order screens after
 * login), where Chrome fires it immediately on load. If we only attached a
 * listener from this effect we'd miss it and never show the button. So an
 * inline script in the root layout captures the event to `window.__bip` the
 * moment it fires; here we just read that global (and re-read it on the
 * `bip` event the script dispatches).
 *
 * iOS Safari doesn't support this event (there it's still Share → Add to Home
 * Screen), so the button simply won't show there.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type BipWindow = Window & { __bip?: BeforeInstallPromptEvent | null };

export function InstallButton() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Register the service worker on every page load (not only when push is
    // enabled) — a registered SW with a fetch handler is the installability
    // requirement. Registering the same /sw.js again is idempotent, so the
    // push flow keeps working.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Pull whatever the early inline script already captured, and keep in
    // sync as it captures a new prompt or the app gets installed.
    const sync = () => setPromptEvent((window as BipWindow).__bip ?? null);
    sync();
    window.addEventListener("bip", sync);
    return () => window.removeEventListener("bip", sync);
  }, []);

  if (!promptEvent) return null;

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    // The captured event can only be used once, regardless of the choice.
    (window as BipWindow).__bip = null;
    setPromptEvent(null);
  }

  return (
    <Button
      onClick={install}
      size="lg"
      className="fixed bottom-4 end-4 z-50 shadow-lg"
    >
      <Download className="size-5" />
      התקנת האפליקציה
    </Button>
  );
}
