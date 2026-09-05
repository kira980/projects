"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Smartphone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerDevice } from "../../actions";

type State = "ready" | "used" | "expired" | "cancelled" | "invalid" | "inactive";

const PROBLEMS: Record<Exclude<State, "ready">, string> = {
  used: "הקישור הזה כבר שימש לחיבור טלפון. בקשו מבעל העסק קישור חדש.",
  expired: "תוקף הקישור פג. בקשו מבעל העסק קישור חדש.",
  cancelled: "הקישור בוטל. בקשו מבעל העסק קישור חדש.",
  invalid: "הקישור אינו תקין. בקשו מבעל העסק קישור חדש.",
  inactive: "החשבון אינו פעיל. פנו לבעל העסק.",
};

/**
 * One button. Pressing it registers THIS phone as the worker's attendance
 * device and takes them straight to the clock screen.
 */
export function EnrollClient({
  token,
  state,
  workerName,
}: {
  token: string;
  state: State;
  workerName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onRegister() {
    setPending(true);
    const result = await registerDevice(token);
    setPending(false);
    if (result.ok) {
      setDone(true);
      toast.success(result.info);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6 text-center">
        <CheckCircle2 className="mx-auto size-16 text-success" aria-hidden />
        <div>
          <h1 className="text-2xl font-bold">הטלפון חובר בהצלחה</h1>
          <p className="mt-1 text-muted-foreground">ברוך הבא, {workerName}</p>
        </div>
        <Button
          size="lg"
          className="h-16 text-lg"
          onClick={() => router.replace("/attendance")}
        >
          המשך להחתמת נוכחות
        </Button>
      </main>
    );
  }

  if (state !== "ready") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6 text-center">
        <XCircle className="mx-auto size-16 text-destructive" aria-hidden />
        <div>
          <h1 className="text-2xl font-bold">לא ניתן לחבר את הטלפון</h1>
          <p className="mt-2 text-muted-foreground">{PROBLEMS[state]}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6 text-center">
      <Smartphone className="mx-auto size-16 text-primary" aria-hidden />
      <div>
        <h1 className="text-2xl font-bold">חיבור הטלפון שלך</h1>
        <p className="mt-2 text-muted-foreground">אתם מתחברים בתור</p>
        <p className="mt-1 text-3xl font-bold">{workerName}</p>
      </div>
      <Button
        size="lg"
        className="h-16 text-lg"
        disabled={pending}
        onClick={onRegister}
      >
        {pending ? "מחבר..." : "חיבור הטלפון הזה"}
      </Button>
      <p className="text-sm text-muted-foreground">
        אחרי החיבור תוכלו להחתים כניסה ויציאה מהטלפון הזה בלבד.
      </p>
    </main>
  );
}
