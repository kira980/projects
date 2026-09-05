"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Lock,
  LockOpen,
  ShieldCheck,
  KeyRound,
  Copy,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallAppButton } from "@/components/install-app-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { businessToday } from "@/lib/db/day-lock";
import { addDays, monthDateRange, normalizeMonth, addMonths } from "@/lib/reports";
import {
  DEFAULT_ITERATIONS,
  MIN_PASSPHRASE_LENGTH,
  deriveKek,
  generateDataKey,
  generateRecoveryCode,
  newSalt,
  normalizeRecoveryCode,
  openTakings,
  sealTakings,
  unwrapDataKey,
  wrapDataKey,
  type Takings,
} from "@/lib/secret/crypto";
import {
  changePassphrase,
  initEncryption,
  listDayCiphers,
  saveDayCipher,
  setRecoveryWrapping,
  type EncryptionSetup,
} from "./actions";

type DayRow = { date: string; takings: Takings | null; unreadable: boolean };

/** First run — choose the passphrase that everything hangs from. */
function SetupScreen({ onDone }: { onDone: () => void }) {
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [pending, setPending] = useState(false);

  const tooShort = pass.length > 0 && pass.length < MIN_PASSPHRASE_LENGTH;
  const mismatch = again.length > 0 && pass !== again;

  async function onCreate() {
    setPending(true);
    try {
      const salt = newSalt();
      const kek = await deriveKek(pass, salt, DEFAULT_ITERATIONS);
      const wrapped = await wrapDataKey(kek, await generateDataKey());
      const result = await initEncryption(salt, DEFAULT_ITERATIONS, wrapped);
      if (result.ok) {
        toast.success("הסיסמה נקבעה");
        onDone();
      } else {
        toast.error(result.error ?? "שגיאה");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 p-6">
      <div className="text-center">
        <ShieldCheck className="mx-auto size-14 text-primary" aria-hidden />
        <h1 className="mt-3 text-2xl font-bold">קביעת סיסמה להכנסות</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          הסיסמה נשארת רק אצלכם. היא לא נשמרת בשרת ואף אחד אחר — כולל מי
          שמתחזק את המערכת — לא יוכל לפתוח את הסכומים בלעדיה.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="pass">סיסמה</Label>
        <Input
          id="pass"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="new-password"
        />
        {tooShort && (
          <p className="text-sm text-destructive">
            לפחות {MIN_PASSPHRASE_LENGTH} תווים — סיסמה קצרה ניתנת לפיצוח.
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="again">אישור סיסמה</Label>
        <Input
          id="again"
          type="password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          autoComplete="new-password"
        />
        {mismatch && <p className="text-sm text-destructive">הסיסמאות אינן זהות</p>}
      </div>

      <div className="flex gap-2 rounded-lg border border-warning/50 bg-warning-soft p-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <span>
          אם תשכחו את הסיסמה לא ניתן יהיה לשחזר את הסכומים. אפשר להוסיף קוד
          שחזור בהמשך מתוך המסך הזה.
        </span>
      </div>

      <Button
        size="lg"
        className="h-14"
        disabled={
          pending || pass.length < MIN_PASSPHRASE_LENGTH || pass !== again
        }
        onClick={onCreate}
      >
        {pending ? "מגדיר..." : "קביעת הסיסמה"}
      </Button>

      <InstallAppButton label="הורדת האפליקציה לטלפון" />
    </main>
  );
}

/** Every visit starts here: the key lives in memory and never on disk. */
function UnlockScreen({
  setup,
  onUnlock,
}: {
  setup: EncryptionSetup;
  onUnlock: (key: CryptoKey) => void;
}) {
  const [pass, setPass] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setPending(true);
    try {
      const [salt, iterations, wrapped] = useRecovery
        ? [setup.recoverySalt!, setup.iterations, setup.recoveryWrappedKey!]
        : [setup.salt, setup.iterations, setup.wrappedKey];
      const secret = useRecovery ? normalizeRecoveryCode(pass) : pass;
      const kek = await deriveKek(secret, salt, iterations);
      onUnlock(await unwrapDataKey(kek, wrapped));
    } catch {
      toast.error(useRecovery ? "קוד שחזור שגוי" : "סיסמה שגויה");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 p-6">
      <div className="text-center">
        <Lock className="mx-auto size-14 text-primary" aria-hidden />
        <h1 className="mt-3 text-2xl font-bold">הכנסות</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {useRecovery ? "הזינו את קוד השחזור" : "הזינו את הסיסמה כדי לפתוח"}
        </p>
      </div>

      <form autoComplete="off"
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        <Input
          type={useRecovery ? "text" : "password"}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          autoFocus
          dir={useRecovery ? "ltr" : undefined}
          className="h-14 text-center text-lg"
          aria-label={useRecovery ? "קוד שחזור" : "סיסמה"}
        />
        <Button
          type="submit"
          size="lg"
          className="h-14"
          disabled={pending || !pass}
        >
          <LockOpen className="size-5" />
          {pending ? "פותח..." : "פתיחה"}
        </Button>
      </form>

      {setup.hasRecovery && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setUseRecovery((v) => !v);
            setPass("");
          }}
        >
          {useRecovery ? "חזרה לסיסמה" : "שכחתי את הסיסמה — שימוש בקוד שחזור"}
        </Button>
      )}

      {/* Installing needs no passphrase, so it belongs on this screen. */}
      <InstallAppButton label="הורדת האפליקציה לטלפון" />
    </main>
  );
}

/** Add a recovery code, when the owner decides they want one. */
function RecoveryCard({
  dataKey,
  hasRecovery,
  onSaved,
}: {
  dataKey: CryptoKey;
  hasRecovery: boolean;
  onSaved: () => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onGenerate() {
    setCode(generateRecoveryCode());
  }

  async function onConfirm() {
    if (!code) return;
    setPending(true);
    try {
      const salt = newSalt();
      const kek = await deriveKek(
        normalizeRecoveryCode(code),
        salt,
        DEFAULT_ITERATIONS
      );
      const wrapped = await wrapDataKey(kek, dataKey);
      const result = await setRecoveryWrapping(salt, wrapped);
      if (result.ok) {
        toast.success("קוד השחזור נשמר");
        setCode(null);
        onSaved();
      } else {
        toast.error(result.error ?? "שגיאה");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" />
          קוד שחזור
          {hasRecovery && <Badge variant="success">קיים</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          קוד שפותח את הסכומים גם בלי הסיסמה. הוא מוצג פעם אחת בלבד — כתבו
          אותו על נייר ושמרו במקום בטוח.
          {hasRecovery && " יצירת קוד חדש מבטלת את הקודם."}
        </p>

        {code ? (
          <>
            <p
              dir="ltr"
              className="rounded-lg border bg-muted/40 p-3 text-center font-mono text-lg tracking-wider"
            >
              {code}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(code);
                  toast.success("הועתק");
                }}
              >
                <Copy className="size-4" />
                העתקה
              </Button>
              <Button size="sm" disabled={pending} onClick={onConfirm}>
                {pending ? "שומר..." : "שמרתי אותו — המשך"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCode(null)}>
                ביטול
              </Button>
            </div>
          </>
        ) : (
          <Button variant="outline" className="w-fit" onClick={onGenerate}>
            {hasRecovery ? "יצירת קוד שחזור חדש" : "יצירת קוד שחזור"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** The unlocked app: enter a day, and read the month back. */
function Vault({
  dataKey,
  setup,
  onLock,
  onSetupChanged,
}: {
  dataKey: CryptoKey;
  setup: EncryptionSetup;
  onLock: () => void;
  onSetupChanged: () => void;
}) {
  const [month, setMonth] = useState(() => businessToday().slice(0, 7));
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(() => businessToday());
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { start, end } = monthDateRange(month);
    const sealed = await listDayCiphers(start, addDays(end, -1));
    const opened: DayRow[] = [];
    for (const row of sealed) {
      if (!row.cipher) continue;
      try {
        opened.push({
          date: row.date,
          takings: await openTakings(dataKey, row.cipher),
          unreadable: false,
        });
      } catch {
        opened.push({ date: row.date, takings: null, unreadable: true });
      }
    }
    return opened;
  }, [dataKey, month]);

  // Fetch-and-decrypt for the month on screen. The flag drops a response
  // that arrives after the month has moved on.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const opened = await load();
      if (!cancelled) {
        setRows(opened);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onSave() {
    setSaving(true);
    try {
      const cipher = await sealTakings(dataKey, {
        cash: Number(cash) || 0,
        card: Number(card) || 0,
        other: Number(other) || 0,
      });
      const result = await saveDayCipher(date, cipher);
      if (result.ok) {
        toast.success("נשמר");
        setCash("");
        setCard("");
        setOther("");
        setRows(await load());
      } else {
        toast.error(result.error ?? "שגיאה");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onChangePass() {
    const next = prompt(`סיסמה חדשה (לפחות ${MIN_PASSPHRASE_LENGTH} תווים):`);
    if (!next) return;
    if (next.length < MIN_PASSPHRASE_LENGTH) {
      toast.error(`הסיסמה חייבת להיות באורך ${MIN_PASSPHRASE_LENGTH} תווים לפחות`);
      return;
    }
    const salt = newSalt();
    const kek = await deriveKek(next, salt, DEFAULT_ITERATIONS);
    const wrapped = await wrapDataKey(kek, dataKey);
    const result = await changePassphrase(salt, DEFAULT_ITERATIONS, wrapped);
    if (result.ok) {
      toast.success("הסיסמה הוחלפה");
      onSetupChanged();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  const total = rows.reduce(
    (sum, r) =>
      r.takings ? sum + r.takings.cash + r.takings.card + r.takings.other : sum,
    0
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">הכנסות</h1>
        <Button variant="outline" size="sm" onClick={onLock}>
          <Lock className="size-4" />
          נעילה
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">רישום יום</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="d">תאריך</Label>
            <Input
              id="d"
              type="date"
              dir="ltr"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["מזומן", cash, setCash],
                ["ויזה", card, setCard],
                ["אחר", other, setOther],
              ] as const
            ).map(([label, value, set]) => (
              <div key={label} className="grid gap-2">
                <Label>{label} (₪)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                />
              </div>
            ))}
          </div>
          <Button
            className="h-12"
            disabled={saving || (!cash && !card && !other)}
            onClick={onSave}
          >
            {saving ? "מצפין ושומר..." : "שמירה מוצפנת"}
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{month}</h2>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMonth(addMonths(month, -1))}
            >
              הקודם
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMonth(normalizeMonth(addMonths(month, 1)))}
            >
              הבא
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>מזומן</TableHead>
                <TableHead>ויזה</TableHead>
                <TableHead>אחר</TableHead>
                <TableHead>סה&quot;כ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    פותח...
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    אין רישומים בחודש זה
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.date}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(r.date)}
                  </TableCell>
                  {r.unreadable ? (
                    <TableCell colSpan={4} className="text-destructive">
                      לא ניתן לפענח
                    </TableCell>
                  ) : (
                    <>
                      <TableCell>{formatMoney(r.takings!.cash)}</TableCell>
                      <TableCell>{formatMoney(r.takings!.card)}</TableCell>
                      <TableCell>{formatMoney(r.takings!.other)}</TableCell>
                      <TableCell className="font-medium">
                        {formatMoney(
                          r.takings!.cash + r.takings!.card + r.takings!.other
                        )}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>סה&quot;כ לחודש</TableCell>
                  <TableCell className="font-bold">{formatMoney(total)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </section>

      <RecoveryCard
        dataKey={dataKey}
        hasRecovery={setup.hasRecovery}
        onSaved={onSetupChanged}
      />

      <Button variant="ghost" size="sm" onClick={onChangePass}>
        החלפת סיסמה
      </Button>
    </main>
  );
}

export function SecretClient({ setup }: { setup: EncryptionSetup }) {
  const [state, setState] = useState(setup);
  const [dataKey, setDataKey] = useState<CryptoKey | null>(null);

  async function refreshSetup() {
    const { getEncryptionSetup } = await import("./actions");
    setState(await getEncryptionSetup());
  }

  if (!state.configured) {
    return <SetupScreen onDone={refreshSetup} />;
  }
  if (!dataKey) {
    return <UnlockScreen setup={state} onUnlock={setDataKey} />;
  }
  return (
    <Vault
      dataKey={dataKey}
      setup={state}
      onLock={() => setDataKey(null)}
      onSetupChanged={refreshSetup}
    />
  );
}
