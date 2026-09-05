"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  LogIn,
  LogOut,
  Banknote,
  PackageOpen,
  HandCoins,
  Receipt,
  ClipboardList,
  History,
  DoorOpen,
  Search,
  MoonStar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TimeField, TIME_RE } from "@/components/ui/time-field";
import { formatTime, toTimeInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useIdleLogout } from "../use-idle-logout";
import { toggleShift, kioskLogout, clockOtherWorker, endDay } from "../actions";

export type WorkerStatus = {
  id: string;
  full_name: string;
  shift_started_at: string | null;
};

/** Shift-manager panels that take over the menu screen. */
type Mode = null | "in" | "out" | "end";

export function MenuClient({
  workerName,
  hasOpenShift,
  canManageShift,
  workers,
}: {
  workerName: string;
  hasOpenShift: boolean;
  canManageShift: boolean;
  /** Active roster with shift state — only sent to shift managers. */
  workers: WorkerStatus[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  // Managers work through a list, so give them a longer idle window.
  useIdleLogout(mode ? 60 : 30);
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [leftInRegister, setLeftInRegister] = useState("");
  // The worker awaiting confirmation in the clock-time box.
  const [clocking, setClocking] = useState<{
    worker: WorkerStatus;
    direction: "in" | "out";
  } | null>(null);

  async function onShiftClick() {
    setPending(true);
    const result = await toggleShift();
    if (result.ok) {
      toast.success(result.info);
      // Auto logout after the action — shared tablet.
      setTimeout(() => void kioskLogout(), 1500);
    } else {
      toast.error(result.error ?? "שגיאה");
      setPending(false);
      router.refresh();
    }
  }

  async function clock(
    worker: WorkerStatus,
    direction: "in" | "out",
    time?: string
  ) {
    setBusyId(worker.id);
    const result = await clockOtherWorker(worker.id, direction, time);
    setBusyId(null);
    if (result.ok) {
      toast.success(result.info);
      setClocking(null);
      router.refresh();
      // The end-of-day panel keeps its list open until it's empty.
      if (mode !== "end") setMode(null);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  const stillOnShift = workers.filter((w) => w.shift_started_at);

  async function onEndDay() {
    setPending(true);
    const result = await endDay(leftInRegister);
    if (result.ok) {
      toast.success(result.info);
      setTimeout(() => void kioskLogout(), 1500);
    } else {
      toast.error(result.error ?? "שגיאה");
      setPending(false);
    }
  }

  const bigButton =
    "h-24 w-full flex-col gap-2 text-lg font-semibold [&_svg]:size-8";

  // ── Shift manager: clock a worker in / out ──
  if (mode === "in" || mode === "out") {
    const candidates = workers
      .filter((w) => (mode === "in" ? !w.shift_started_at : !!w.shift_started_at))
      .filter(
        (w) =>
          !query.trim() ||
          w.full_name.toLowerCase().includes(query.trim().toLowerCase())
      );

    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
        <PanelHeader
          title={mode === "in" ? "התחלת משמרת" : "סיום משמרת"}
          subtitle={`${stillOnShift.length} עובדים במשמרת כרגע`}
          onBack={() => {
            setQuery("");
            setMode(null);
          }}
        />
        <div className="relative">
          <Search
            className="absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש עובד..."
            className="h-12 ps-10 text-lg"
            aria-label="חיפוש עובד"
          />
        </div>
        {candidates.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            {mode === "in" ? "כל העובדים כבר במשמרת" : "אין עובדים במשמרת כרגע"}
          </p>
        )}
        <div className="grid gap-3">
          {candidates.map((w) => (
            <WorkerRow
              key={w.id}
              worker={w}
              disabled={busyId === w.id}
              onClick={() => setClocking({ worker: w, direction: mode })}
              icon={
                mode === "in" ? (
                  <LogIn className="size-6 text-success" />
                ) : (
                  <LogOut className="size-6 text-destructive" />
                )
              }
            />
          ))}
        </div>

        <ClockTimeDialog
          clocking={clocking}
          busy={busyId !== null}
          onCancel={() => setClocking(null)}
          onConfirm={clock}
        />
      </main>
    );
  }

  // ── Shift manager: end of day — clock everyone out, record the register ──
  if (mode === "end") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-6">
        <PanelHeader
          title="סיום יום"
          subtitle={workerName}
          onBack={() => setMode(null)}
        />

        {/* Informational, not a checklist — workers whose shift runs into
            the next day stay clocked in through the day close. */}
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">
            עובדים במשמרת
            {stillOnShift.length > 0 && ` (${stillOnShift.length})`}
          </h2>
          {stillOnShift.length === 0 ? (
            <p className="rounded-xl border bg-card p-4 text-center text-muted-foreground">
              אין עובדים במשמרת
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                אפשר לסיים את היום גם כשעובדים עדיין במשמרת — מי שממשיך לעבוד
                נשאר במשמרת. להחתמת יציאה יש ללחוץ על השם.
              </p>
              <div className="grid gap-3">
                {stillOnShift.map((w) => (
                  <WorkerRow
                    key={w.id}
                    worker={w}
                    disabled={busyId === w.id}
                    onClick={() => setClocking({ worker: w, direction: "out" })}
                    icon={<LogOut className="size-6 text-destructive" />}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <div className="grid gap-2">
          <Label htmlFor="left_in_register" className="text-base">
            נשאר בקופה (₪) *
          </Label>
          <Input
            id="left_in_register"
            value={leftInRegister}
            onChange={(e) => setLeftInRegister(e.target.value)}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            dir="ltr"
            className="h-14 text-center text-2xl font-bold"
          />
        </div>

        <Button
          variant="destructive-solid"
          disabled={pending}
          onClick={onEndDay}
          className="h-16 text-lg"
        >
          <MoonStar className="size-6" />
          {pending ? "שומר..." : "סיום יום"}
        </Button>

        <ClockTimeDialog
          clocking={clocking}
          busy={busyId !== null}
          onCancel={() => setClocking(null)}
          onConfirm={clock}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">שלום, {workerName}</h1>
          <p className="flex items-center gap-2 text-base text-muted-foreground">
            <span
              className={`inline-block size-2.5 rounded-full ${
                hasOpenShift ? "bg-success" : "bg-muted-foreground/40"
              }`}
              aria-hidden
            />
            {hasOpenShift ? "יש לך משמרת פתוחה" : "אין משמרת פתוחה"}
          </p>
        </div>
        <Button variant="outline" size="lg" onClick={() => void kioskLogout()}>
          <DoorOpen className="size-5" />
          יציאה
        </Button>
      </div>

      {/* Shift managers clock everyone (including themselves) from here;
          regular workers keep their own smart button. */}
      {canManageShift ? (
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="success"
            className={bigButton}
            onClick={() => setMode("in")}
          >
            <LogIn />
            התחלת משמרת
          </Button>
          <Button
            variant="destructive-solid"
            className={bigButton}
            onClick={() => setMode("out")}
          >
            <LogOut />
            סיום משמרת
          </Button>
        </div>
      ) : (
        <Button
          size="lg"
          disabled={pending}
          onClick={onShiftClick}
          variant={hasOpenShift ? "destructive-solid" : "success"}
          className={bigButton}
        >
          {hasOpenShift ? <LogOut /> : <LogIn />}
          {pending ? "רגע..." : hasOpenShift ? "סיום משמרת" : "התחלת משמרת"}
        </Button>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Button variant="outline" className={bigButton} asChild>
          <Link href="/workers/advance">
            <Banknote />
            מפרעה
          </Link>
        </Button>
        <Button variant="outline" className={bigButton} asChild>
          <Link href="/workers/vendor-arrival">
            <PackageOpen />
            קבלת סחורה
          </Link>
        </Button>
        <Button variant="outline" className={bigButton} asChild>
          <Link href="/workers/pay-vendor-debt">
            <HandCoins />
            תשלום חוב לספק
          </Link>
        </Button>
        <Button variant="outline" className={bigButton} asChild>
          <Link href="/workers/expense">
            <Receipt />
            תשלום אחר
          </Link>
        </Button>
        {canManageShift && (
          <Button variant="outline" className={bigButton} asChild>
            <Link href="/workers/orders">
              <ClipboardList />
              הזמנות
            </Link>
          </Button>
        )}
        {canManageShift && (
          <Button variant="outline" className={bigButton} asChild>
            <Link href="/workers/history">
              <History />
              היסטוריה
            </Link>
          </Button>
        )}
      </div>

      {canManageShift && (
        <Button
          variant="destructive-solid"
          className={bigButton}
          onClick={() => setMode("end")}
        >
          <MoonStar />
          סיום יום
        </Button>
      )}
    </main>
  );
}

function PanelHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" aria-label="חזרה" onClick={onBack}>
        <ArrowRight className="size-6" />
      </Button>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Confirmation box for a clock-in / clock-out. It opens on the current
 * time, which is right almost every time, and lets the manager correct it
 * — someone finishes at 22:00 and only reaches the tablet at 22:20.
 *
 * The time is always read as today's. A reading still ahead of the clock
 * is refused by the server with the current time in the message; entering
 * the shift's scheduled start a few minutes early used to file the whole
 * shift a day back instead of saying anything.
 */
function ClockTimeDialog({
  clocking,
  busy,
  onCancel,
  onConfirm,
}: {
  clocking: { worker: WorkerStatus; direction: "in" | "out" } | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (
    worker: WorkerStatus,
    direction: "in" | "out",
    time: string
  ) => void;
}) {
  const [time, setTime] = useState("");

  // Re-open on the current time for each worker, not the last one's edit.
  const key = clocking ? `${clocking.worker.id}:${clocking.direction}` : null;
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (key !== openedFor) {
    setOpenedFor(key);
    setTime(key ? toTimeInput(new Date()) : "");
  }

  if (!clocking) return null;
  const isIn = clocking.direction === "in";

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {clocking.worker.full_name}
          </DialogTitle>
          <DialogDescription>
            {isIn ? "החתמת כניסה למשמרת" : "החתמת יציאה מהמשמרת"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="clock_time" className="text-base">
            {isIn ? "כניסה ב" : "יציאה ב"}
          </Label>
          {/* Typed, not picked: type="time" opens the OS clock wheel on a
              tablet, which is slower than tapping four digits — and it
              renders in the browser's own 12-hour locale. */}
          <TimeField
            id="clock_time"
            value={time}
            onChange={setTime}
            className="h-16 text-3xl font-bold"
          />
          <p className="text-sm text-muted-foreground">
            ברירת המחדל היא השעה עכשיו — אפשר להקליד שעה שכבר עברה היום
            (24 שעות). שעה שעוד לא הגיעה לא תישמר.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-14 flex-1 text-base" onClick={onCancel}>
            ביטול
          </Button>
          <Button
            variant={isIn ? "success" : "destructive-solid"}
            className="h-14 flex-1 text-base"
            disabled={busy || !TIME_RE.test(time)}
            onClick={() => onConfirm(clocking.worker, clocking.direction, time)}
          >
            {busy ? "רגע..." : isIn ? "אישור כניסה" : "אישור יציאה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkerRow({
  worker,
  disabled,
  onClick,
  icon,
}: {
  worker: WorkerStatus;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-4 text-start transition-colors",
        "hover:bg-muted/60 disabled:opacity-50"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-semibold">{worker.full_name}</div>
        {worker.shift_started_at ? (
          <Badge variant="success">
            במשמרת מ־{formatTime(worker.shift_started_at)}
          </Badge>
        ) : (
          <Badge variant="outline">לא במשמרת</Badge>
        )}
      </div>
      {icon}
    </button>
  );
}
