import Link from "next/link";
import {
  Gauge,
  ClipboardList,
  ChefHat,
  Truck,
  MapPin,
  Lock,
  ArrowLeft,
} from "lucide-react";
import { DEMO_CREDENTIALS } from "@/lib/demo-backend/seed";
import { databaseSummary } from "@/lib/demo-backend/store";
import { DEMO_PASSWORD } from "@/lib/demo-backend/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "מסך הבית" };

/**
 * The demo's front door.
 *
 * The production system has no page like this: each role installs its own
 * app from its own URL and never sees the others. Here every entrance is in
 * one place, with the passcode needed to get in, so the whole system can be
 * explored in one sitting.
 */

const APPS = [
  {
    href: "/dashboard",
    icon: Gauge,
    title: "לוח בקרה — בעלים",
    description:
      "מבט יומי, הזמנות, לקוחות וחובות, ספקים, עובדים ושכר, הוצאות, דוחות ויומן פעולות.",
    how: "כניסה עם אימייל וסיסמה",
    accent: "bg-primary-soft text-primary",
  },
  {
    href: "/workers",
    icon: ClipboardList,
    title: "עמדת עובדים",
    description:
      "טאבלט משותף במאפייה: כניסת ויציאת עובדים, קבלת סחורה מספקים, הוצאות, מקדמות ותשלומי חוב.",
    how: "קוד אישי בן 4 ספרות",
    accent: "bg-info-soft text-info",
  },
  {
    href: "/production",
    icon: ChefHat,
    title: "מסך אופים",
    description:
      "מה צריך להכין היום ומחר, מרוכז לפי מוצר. סימון הכנה, דיווח חוסרים וסיכום יומי.",
    how: "קוד אישי — נשאר מחובר כל היום",
    accent: "bg-warning-soft text-warning-foreground",
  },
  {
    href: "/driver",
    icon: Truck,
    title: "אפליקציית נהג",
    description:
      "משלוחי היום לפי סדר, מפה, סימון מסירה, גביית תשלום בדלת ותשלום חובות לקוח.",
    how: "קוד אישי של נהג",
    accent: "bg-success-soft text-success",
  },
  {
    href: "/attendance",
    icon: MapPin,
    title: "נוכחות מהנייד — עובדי המפעל",
    description:
      "עובדי מפעל הייצור מדווחים כניסה ויציאה מהטלפון האישי שלהם. הדיווח מאושר רק אחרי שלוש בדיקות: המכשיר נרשם מראש על ידי המנהל, המיקום נמצא בתוך גדר וירטואלית סביב המפעל, והבקשה הגיעה דרך רשת ה־Wi‑Fi של המפעל.",
    how: "ללא סיסמה — המכשיר, המיקום והרשת הם האימות",
    accent: "bg-info-soft text-info",
  },
  {
    href: "/secret",
    icon: Lock,
    title: "קופה מוצפנת",
    description:
      "פדיון יומי שמוצפן בדפדפן של הבעלים בלבד. גם למי שיש גישה למסד הנתונים רואה טקסט חסר משמעות.",
    how: "סיסמה שנקבעת במכשיר — בחרו אחת",
    accent: "bg-muted text-muted-foreground",
  },
] as const;

export default function Home() {
  const summary = databaseSummary();
  const rows = summary.reduce((total, entry) => total + entry.rows, 0);
  const orders = summary.find((entry) => entry.table === "orders")?.rows ?? 0;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-5 sm:p-8">
      <header className="mb-8">
        <span className="inline-flex items-center rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning-foreground">
          גרסת הדגמה · נתונים בדיוניים
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          מערכת ניהול מאפייה
        </h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
          מערכת תפעולית אחת שמריצה את היום במאפיית סיטונאות: הזמנות מלקוחות
          עסקיים, תכנון הייצור ללילה, סבב המשלוחים בבוקר, שעות העובדים, חובות
          לקוחות וספקים, הוצאות וקופה. לכל תפקיד יש אפליקציה משלו — כי אופה עם
          ידיים בקמח ובעל עסק מול מחשב צריכים מסכים שונים לגמרי.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          זו גרסה ציבורית של מערכת שפיתחתי למאפייה פעילה. הקוד הוא אותו קוד;
          מה שהוחלף הוא מסד הנתונים — במקום PostgreSQL מנוהל, המערכת רצה כאן על
          מסד נתונים בזיכרון עם{" "}
          <strong className="text-foreground">{rows.toLocaleString("he-IL")}</strong>{" "}
          רשומות בדיוניות, ובהן{" "}
          <strong className="text-foreground">{orders.toLocaleString("he-IL")}</strong>{" "}
          הזמנות. אין כאן שום נתון אמיתי של עסק, לקוח או עובד.
        </p>
      </header>

      <section aria-labelledby="apps">
        <h2 id="apps" className="mb-3 text-sm font-semibold text-muted-foreground">
          שש אפליקציות, מסד נתונים אחד
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {APPS.map((app) => {
            const Icon = app.icon;
            return (
              <li key={app.href}>
                <Link
                  href={app.href}
                  className="group flex h-full flex-col rounded-xl border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/40"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${app.accent}`}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="text-base font-semibold">{app.title}</h3>
                    <ArrowLeft className="ms-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" />
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {app.description}
                  </p>
                  <p className="mt-3 text-xs font-medium text-muted-foreground">
                    {app.how}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="creds" className="mt-8">
        <h2 id="creds" className="mb-3 text-sm font-semibold text-muted-foreground">
          פרטי כניסה להדגמה
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold">לוח הבקרה</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              אימייל וסיסמה, כמו במערכת האמיתית.
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              {DEMO_CREDENTIALS.admins.map((admin) => (
                <div key={admin.email} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">{admin.name}</dt>
                  <dd className="font-mono text-xs" dir="ltr">
                    {admin.email}
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 border-t pt-2">
                <dt className="text-muted-foreground">סיסמה</dt>
                <dd className="font-mono text-xs" dir="ltr">
                  {DEMO_PASSWORD}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold">קודי עובדים</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              עמדת העובדים, מסך האופים ואפליקציית הנהג נפתחים בקוד בן 4 ספרות.
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              {DEMO_CREDENTIALS.workers
                .filter((worker) => worker.roles.length > 0)
                .map((worker) => (
                  <div key={worker.passcode} className="flex items-baseline justify-between gap-3">
                    <dt className="min-w-0 truncate text-muted-foreground">
                      {worker.name}
                      <span className="ms-2 text-xs text-muted-foreground/70">
                        {worker.roles.join(" · ")}
                      </span>
                    </dt>
                    <dd className="font-mono text-xs tabular-nums" dir="ltr">
                      {worker.passcode}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-xl border bg-muted/40 p-5">
        <h2 className="text-sm font-semibold">איך ההדגמה עובדת</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          כל הכתיבות נשמרות בזיכרון של השרת, כך שהזמנה שתיצרו תופיע במסך האופים
          ובאפליקציית הנהג. הפעלה מחדש של השרת מאפסת הכול לנתוני ההדגמה
          המקוריים, ואפשר גם לאפס בלי להפעיל מחדש דרך{" "}
          <code className="rounded bg-background px-1 py-0.5 text-xs" dir="ltr">
            POST /api/demo/reset
          </code>
          .
        </p>
      </section>
    </main>
  );
}
