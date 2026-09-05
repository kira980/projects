"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  QrCode,
  MessageCircle,
  RefreshCw,
  Unplug,
  Copy,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createEnrollment,
  cancelEnrollment,
  enrollmentStatus,
  revokeDevice,
  type EnrollmentSession,
} from "./device-actions";

/** What the workers table knows about a worker's phone. */
export type DeviceState = {
  connected: boolean;
  connectedAt: string | null;
};

function Countdown({ until }: { until: string }) {
  const [left, setLeft] = useState(() => Date.parse(until) - Date.now());

  useEffect(() => {
    const timer = setInterval(() => setLeft(Date.parse(until) - Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);

  if (left <= 0) return <span className="text-destructive">פג תוקף</span>;
  const total = Math.floor(left / 1000);
  return (
    <span className="tabular-nums">
      {String(Math.floor(total / 60)).padStart(2, "0")}:
      {String(total % 60).padStart(2, "0")}
    </span>
  );
}

/**
 * "Connect this worker's phone" — one enrollment session shown two ways.
 *
 * The QR and the WhatsApp link are the same one-time token, so whichever
 * the worker reaches first registers the phone and kills the other. While
 * the box is open the server is polled, and the moment the phone registers
 * the box says so and closes itself.
 */
export function DeviceDialog({
  workerId,
  workerName,
  hasPhone,
  device,
}: {
  workerId: string;
  workerName: string;
  /** Drives the wording of the WhatsApp button, nothing more. */
  hasPhone: boolean;
  device: DeviceState;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [session, setSession] = useState<EnrollmentSession | null>(null);
  const [connected, setConnected] = useState(device.connected);

  // While a code is on screen, watch for the phone registering.
  useEffect(() => {
    if (!open || !session || connected) return;
    const timer = setInterval(async () => {
      const { connected: now } = await enrollmentStatus(workerId);
      if (now) {
        setConnected(true);
        setSession(null);
        toast.success(`הטלפון של ${workerName} חובר`);
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [open, session, connected, workerId, workerName, router]);

  async function start() {
    setPending(true);
    const result = await createEnrollment(workerId);
    setPending(false);
    if (result.ok) setSession(result);
    else toast.error(result.error);
  }

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setConnected(device.connected);
      setSession(null);
      if (!device.connected) await start();
    } else if (session && !connected) {
      // Closing the box without waiting invalidates the code.
      await cancelEnrollment(workerId);
      setSession(null);
    }
  }

  async function onReplace() {
    if (
      !confirm(
        `להחליף את הטלפון של ${workerName}? הטלפון הנוכחי לא יוכל עוד להחתים כניסה או יציאה.`
      )
    ) {
      return;
    }
    setConnected(false);
    await start();
  }

  async function onDisconnect() {
    if (
      !confirm(
        `לנתק את הטלפון של ${workerName}? הוא לא יוכל להחתים נוכחות עד שיחובר טלפון חדש.`
      )
    ) {
      return;
    }
    setPending(true);
    const result = await revokeDevice(workerId);
    setPending(false);
    if (result.ok) {
      toast.success("הטלפון נותק");
      setConnected(false);
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`חיבור טלפון — ${workerName}`}
        title="חיבור טלפון לנוכחות"
        onClick={() => void onOpenChange(true)}
      >
        <QrCode className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={(v) => void onOpenChange(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>חיבור הטלפון של {workerName}</DialogTitle>
            <DialogDescription>
              {connected
                ? "לטלפון המחובר יש הרשאה להחתים כניסה ויציאה."
                : "בקשו מהעובד לסרוק את הקוד בטלפון שלו."}
            </DialogDescription>
          </DialogHeader>

          {connected ? (
            <div className="grid gap-3 text-center">
              <Badge variant="success" className="mx-auto">
                טלפון מחובר
              </Badge>
              <div className="grid gap-2">
                <Button variant="outline" onClick={onReplace} disabled={pending}>
                  <RefreshCw className="size-4" />
                  החלפת טלפון
                </Button>
                <Button
                  variant="destructive"
                  onClick={onDisconnect}
                  disabled={pending}
                >
                  <Unplug className="size-4" />
                  ניתוק הטלפון
                </Button>
              </div>
            </div>
          ) : session ? (
            <div className="grid gap-4 text-center">
              <Image
                src={session.qr}
                alt="קוד לסריקה"
                width={256}
                height={256}
                unoptimized
                className="mx-auto rounded-lg border bg-white p-2"
              />
              <p className="text-sm text-muted-foreground">
                הקוד בתוקף ל־<Countdown until={session.expiresAt} /> וניתן
                לשימוש פעם אחת בלבד.
              </p>

              {session.unreachable && (
                <div className="flex gap-2 rounded-lg border border-warning/50 bg-warning-soft p-3 text-start text-sm">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <span>
                    הקישור מצביע לכתובת בדיקה שדורשת התחברות ל־Vercel, והעובד
                    לא יוכל לפתוח אותו. יש להגדיר את NEXT_PUBLIC_APP_URL לכתובת
                    הקבועה של המערכת.
                  </span>
                </div>
              )}

              <div className="grid gap-1">
                <p
                  dir="ltr"
                  className="truncate rounded-md border bg-muted/40 p-2 text-start text-xs text-muted-foreground"
                >
                  {session.url}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(session.url);
                    toast.success("הקישור הועתק");
                  }}
                >
                  <Copy className="size-4" />
                  העתקת הקישור
                </Button>
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-medium">לא מצליחים לסרוק?</p>
                <Button variant="success" asChild>
                  <a href={session.whatsapp} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" />
                    {hasPhone ? "שליחת קישור בוואטסאפ" : "בחירת איש קשר בוואטסאפ"}
                  </a>
                </Button>
                {!hasPhone && (
                  <p className="text-xs text-muted-foreground">
                    לעובד אין טלפון שמור — וואטסאפ ייפתח עם רשימת אנשי הקשר
                    שלכם לבחירה. אין צורך לשמור את המספר במערכת.
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={() => void onOpenChange(false)}>
                ביטול
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                {pending ? "מכין קוד..." : "לא נוצר קוד."}
              </p>
              {!pending && (
                <Button onClick={start}>
                  <QrCode className="size-4" />
                  יצירת קוד חדש
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
