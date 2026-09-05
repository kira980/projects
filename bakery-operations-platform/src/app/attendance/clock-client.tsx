"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, LogOut, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTime, formatHours } from "@/lib/format";
import { clockAction } from "./actions";

export type TodayShift = {
  id: string;
  startedAt: string;
  endedAt: string | null;
};

/** GPS, asked for only at the moment of clocking. */
function readPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("no_geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
  });
}

/**
 * Clock in / clock out, and today's record underneath.
 *
 * The location is read here but decides nothing — the server re-checks the
 * distance, the network and the worker before writing anything.
 */
export function ClockClient({
  workerName,
  workerActive,
  openSince,
  shifts,
}: {
  workerName: string;
  workerActive: boolean;
  /** When the open shift began, or null when not clocked in. */
  openSince: string | null;
  shifts: TodayShift[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const isIn = openSince !== null;

  async function onClock() {
    setPending(true);
    let coords: { lat: number; lng: number; accuracy?: number } | null = null;
    try {
      const pos = await readPosition();
      coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch {
      setPending(false);
      toast.error("אין גישה למיקום. אשרו הרשאת מיקום בטלפון ונסו שוב.");
      return;
    }

    const result = await clockAction(isIn ? "out" : "in", coords);
    setPending(false);
    if (result.ok) {
      toast.success(result.info);
      router.refresh();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  const greeting = new Date().getHours() < 12 ? "בוקר טוב" : "ערב טוב";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}, {workerName}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-muted-foreground">
          {isIn ? (
            <>
              <Badge variant="success">במשמרת</Badge>
              מ־{formatTime(openSince)}
            </>
          ) : (
            <Badge variant="outline">לא במשמרת</Badge>
          )}
        </p>
      </div>

      {!workerActive ? (
        <p className="rounded-xl border bg-card p-4 text-center text-muted-foreground">
          החשבון שלך אינו פעיל. פנו לבעל העסק.
        </p>
      ) : (
        <Button
          size="lg"
          variant={isIn ? "destructive-solid" : "success"}
          disabled={pending}
          onClick={onClock}
          className="h-32 w-full flex-col gap-2 text-2xl font-bold [&_svg]:size-10"
        >
          {isIn ? <LogOut /> : <LogIn />}
          {pending ? "רגע..." : isIn ? "סיום משמרת" : "התחלת משמרת"}
        </Button>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
        <MapPin className="size-4" aria-hidden />
        ההחתמה מתאפשרת רק במקום העבודה וברשת שלו
      </p>

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">היום</h2>
        {shifts.length === 0 && (
          <p className="rounded-xl border bg-card p-4 text-center text-muted-foreground">
            עדיין לא נרשמה משמרת היום
          </p>
        )}
        {shifts.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-xl border bg-card p-4"
          >
            <span className="font-medium">
              {formatTime(s.startedAt)}
              {" – "}
              {s.endedAt ? formatTime(s.endedAt) : "עכשיו"}
            </span>
            <span className="text-muted-foreground">
              {s.endedAt ? formatHours(s.startedAt, s.endedAt) : "במשמרת"}
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}
