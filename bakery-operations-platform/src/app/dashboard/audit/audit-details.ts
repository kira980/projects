import {
  formatMoney,
  formatDate,
  formatDateTime,
  toTimeInput,
} from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHODS,
  type OrderStatus,
} from "@/lib/order-status";

/**
 * The audit log stores raw jsonb — ids, ISO timestamps, boolean flags.
 * This turns a row into one Hebrew sentence that says what actually
 * happened, resolving ids to names where the page could look them up.
 *
 * Every action gets a describer; unknown ones (a new action shipped before
 * this file catches up) fall back to labelled "key: value" pairs rather
 * than to nothing.
 */

/** Every audit action key, in plain Hebrew. */
export const ACTION_LABELS: Record<string, string> = {
  "order.create": "יצירת הזמנה",
  "order.delete": "מחיקת הזמנה",
  "order.status_change": "שינוי סטטוס הזמנה",
  "order.shortage": "דיווח חוסר בהזמנה",
  "order.production_status": "עדכון סטטוס אפייה",
  "order.mark_all_ready": "סימון כל ההזמנות כמוכנות",
  "order.handed_delivery": "מסירת הזמנה לשליח",
  "order.picked_up": "איסוף הזמנה ע\"י הלקוח",
  "payment.record": "רישום תשלום",
  "payment.driver_collect": "גביית תשלום ע\"י נהג",
  "payment.driver_collect_multi": "גביית חוב מרוכזת ע\"י נהג",
  "delivery.delivered_paid": "משלוח נמסר ושולם",
  "delivery.delivered_unpaid": "משלוח נמסר ללא תשלום",
  "delivery.partial": "משלוח נמסר בתשלום חלקי",
  "delivery.failed": "משלוח לא נמסר",
  "quote.create": "הפקת הצעת מחיר",
  "receipt.create": "הפקת קבלה",
  "delivery_note.create": "הפקת תעודת משלוח",
  "customer.create": "הוספת לקוח",
  "customer.update": "עדכון לקוח",
  "customer.activate": "הפעלת לקוח",
  "customer.deactivate": "השבתת לקוח",
  "customer.receipt_on": "הפעלת קבלות ללקוח",
  "customer.receipt_off": "כיבוי קבלות ללקוח",
  "customer_price.set": "עדכון מחיר מיוחד ללקוח",
  "worker.create": "הוספת עובד",
  "worker.update": "עדכון עובד",
  "worker.activate": "הפעלת עובד",
  "worker.deactivate": "השבתת עובד",
  "worker.passcode_reset": "איפוס קוד אישי לעובד",
  "vendor.create": "הוספת ספק",
  "vendor.update": "עדכון ספק",
  "vendor.activate": "הפעלת ספק",
  "vendor.deactivate": "השבתת ספק",
  "vendor_order.create": "קבלת סחורה מספק",
  "vendor_order.update": "עריכת קבלת סחורה",
  "vendor_order.delete": "מחיקת קבלת סחורה",
  "vendor_payment.create": "תשלום לספק",
  "vendor_payment.update": "עריכת תשלום לספק",
  "vendor_payment.delete": "מחיקת תשלום לספק",
  "product.create": "הוספת מוצר",
  "product.update": "עדכון מוצר",
  "product.delete": "מחיקת מוצר",
  "product.activate": "הפעלת מוצר",
  "product.deactivate": "השבתת מוצר",
  "private_payment.create": "רישום תשלום פרטי",
  "private_payment.update": "עריכת תשלום פרטי",
  "private_payment.delete": "מחיקת תשלום פרטי",
  "expense.create": "רישום הוצאה",
  "expense.update": "עריכת הוצאה",
  "expense.delete": "מחיקת הוצאה",
  "daily_sales.save": "עדכון כסף בקופה",
  "secret.init": "הגדרת סיסמה להכנסות",
  "secret.passphrase_change": "החלפת סיסמת הכנסות",
  "secret.recovery_set": "הגדרת קוד שחזור להכנסות",
  "secret.day_save": "רישום הכנסות מוצפן",
  "day.lock": "נעילת יום",
  "day.reopen": "פתיחת יום מחדש",
  "day.end": "סגירת יום ע\"י אחראי משמרת",
  "business.update": "עדכון פרטי העסק",
  "shift.start": "תחילת משמרת",
  "shift.end": "סיום משמרת",
  "shift.start_by_manager": "החתמת כניסה ע\"י אחראי",
  "shift.end_by_manager": "החתמת יציאה ע\"י אחראי",
  "shift.update_times": "תיקון שעות משמרת",
  "shift.create": "הוספת משמרת ע\"י מנהל",
  "shift.delete": "מחיקת משמרת",
  "shift.close_by_admin": "סגירת משמרת ע\"י מנהל",
  "shift.bulk_set": "עדכון שעות למספר ימים",
  "advance.give": "מתן מפרעה",
  "advance.create": "רישום מפרעה ע\"י מנהל",
  "advance.update": "עריכת מפרעה",
  "advance.delete": "מחיקת מפרעה",
  "android.receipt_printed": "הדפסת קבלה",
  "android.receipt_print_failed": "כשל בהדפסת קבלה",
  "device.enrollment_start": "יצירת קוד לחיבור טלפון",
  "device.register": "חיבור טלפון לעובד",
  "device.revoke": "ניתוק טלפון של עובד",
  "attendance.location_set": "עדכון מיקום מקום העבודה",
  "attendance.network_add": "רישום רשת למקום העבודה",
  "attendance.network_remove": "הסרת רשת ממקום העבודה",
  "kiosk.login": "כניסה לקיוסק",
  "driver.login": "כניסה לאפליקציית נהג",
  "production.login": "כניסה למסך אפייה",
};

const METHOD_LABELS = new Map<string, string>(
  PAYMENT_METHODS.map((m) => [m.value, m.label])
);

const MONEY_KEYS = new Set([
  "amount",
  "total",
  "original_total",
  "updated_total",
  "price",
  "cash",
  "card",
  "other",
  "collected",
  "left_in_register",
]);
const DATE_KEYS = new Set([
  "date",
  "sales_date",
  "expense_date",
  "delivery_date",
]);
const TIME_KEYS = new Set(["started_at", "ended_at", "taken_at", "paid_at"]);
// An arrival that moved to another day is the whole point of the change —
// the date has to show, not just the hour.
const DATETIME_KEYS = new Set(["received_at"]);
const STATUS_KEYS = new Set(["from", "to", "status_before", "status"]);
const BOOL_KEYS = new Set(["paid", "is_available", "reprint"]);

/** Detail keys → Hebrew labels. Unknown keys fall back to the raw key. */
const DETAIL_LABELS: Record<string, string> = {
  order_number: "הזמנה",
  order_ids: "הזמנות",
  total: "סה\"כ",
  original_total: "סה\"כ מקורי",
  updated_total: "סה\"כ מעודכן",
  amount: "סכום",
  collected: "נגבה",
  price: "מחיר",
  method: "אמצעי תשלום",
  items: "פריטים",
  count: "כמות",
  from: "מ",
  to: "ל",
  status_before: "סטטוס קודם",
  note: "הערה",
  notes: "הערה",
  name: "שם",
  full_name: "שם",
  description: "תיאור",
  phone: "טלפון",
  date: "תאריך",
  sales_date: "תאריך",
  expense_date: "תאריך",
  delivery_date: "תאריך אספקה",
  delivery_type: "סוג מסירה",
  delivery_code: "קוד מסירה",
  cash: "מזומן",
  card: "אשראי",
  other: "אחר",
  left_in_register: "נשאר בקופה",
  open_shifts_left: "משמרות פתוחות",
  started_at: "כניסה",
  ended_at: "יציאה",
  start_time: "כניסה",
  end_time: "יציאה",
  received_at: "תאריך קבלה",
  days: "ימים",
  skipped: "ימים שדולגו",
  taken_at: "שעה",
  paid: "שולם",
  is_available: "זמין",
  source: "מקור",
  worker_name: "עובד",
  printer_name: "מדפסת",
  paper: "נייר",
  reprint: "הדפסה חוזרת",
  doc_number: "מספר מסמך",
  vendor_id: "ספק",
  worker_id: "עובד",
  customer_id: "לקוח",
  product_id: "מוצר",
  vendor_order_id: "חשבונית",
  paid_to: "למי שולם",
  radius_m: "רדיוס (מטר)",
  via: "מקור",
};

/** id → display name, filled by the page from the rows it is showing. */
export type NameLookup = Map<string, string>;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function formatValue(key: string, value: unknown, names: NameLookup): string {
  if (value === null || value === undefined || value === "") return "";
  if (key.endsWith("_id")) return names.get(String(value)) ?? "";
  if (BOOL_KEYS.has(key)) return value ? "כן" : "לא";
  if (MONEY_KEYS.has(key) && !isNaN(Number(value))) {
    return formatMoney(Number(value));
  }
  if (DATE_KEYS.has(key)) return formatDate(String(value));
  if (DATETIME_KEYS.has(key)) return formatDateTime(String(value));
  if (TIME_KEYS.has(key)) return toTimeInput(String(value));
  if (STATUS_KEYS.has(key)) {
    return ORDER_STATUS_LABELS[value as OrderStatus] ?? String(value);
  }
  if (key === "method" || key === "payment_method") {
    return METHOD_LABELS.get(String(value)) ?? String(value);
  }
  if (key === "order_number" || key === "doc_number") return `#${value}`;
  if (Array.isArray(value)) return String(value.length);
  if (isObject(value)) return "";
  return String(value);
}

/** "כניסה: מ־08:00 ל־08:30" — one changed field of a from/to pair. */
function changeLine(
  key: string,
  before: unknown,
  after: unknown,
  names: NameLookup
): string | null {
  // The invoice a payment closes is an id with no name to show — what
  // matters is whether it is still tied to one.
  if (key === "vendor_order_id" && before !== after) {
    return after ? "שויך לחשבונית" : "בוטל השיוך לחשבונית";
  }
  const from = formatValue(key, before, names);
  const to = formatValue(key, after, names);
  if (from === to) return null;
  const label = DETAIL_LABELS[key] ?? key;
  if (!from) return `${label}: ${to}`;
  if (!to) return `${label}: ${from} → הוסר`;
  return `${label}: מ־${from} ל־${to}`;
}

/**
 * A `{ from: {...}, to: {...} }` payload as the list of fields that
 * actually moved. Unchanged fields are left out — the point of the column
 * is what changed.
 */
function describeChanges(
  details: Record<string, unknown>,
  names: NameLookup
): string {
  const from = details.from;
  const to = details.to;
  if (!isObject(from) || !isObject(to)) return "";
  const lines: string[] = [];
  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const line = changeLine(key, from[key], to[key], names);
    if (line) lines.push(line);
  }
  return lines.join(" · ");
}

/** Labelled pairs — the fallback for actions with no describer of their own. */
function describePairs(
  details: Record<string, unknown>,
  names: NameLookup
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    // A raw id with no name behind it says nothing to a human reader.
    const formatted = formatValue(key, value, names);
    if (!formatted) continue;
    parts.push(`${DETAIL_LABELS[key] ?? key}: ${formatted}`);
  }
  return parts.join(" · ");
}

type Describer = (
  d: Record<string, unknown>,
  names: NameLookup
) => string | null;

/** Joins the pieces of a sentence, dropping the ones that came out empty. */
const join = (...parts: unknown[]) =>
  parts.filter((p) => typeof p === "string" && p !== "").join(" · ");

const money = (v: unknown) => formatMoney(Number(v ?? 0));
const method = (v: unknown) =>
  v ? (METHOD_LABELS.get(String(v)) ?? String(v)) : null;
const who = (id: unknown, names: NameLookup) =>
  id ? (names.get(String(id)) ?? null) : null;
const status = (v: unknown) =>
  ORDER_STATUS_LABELS[v as OrderStatus] ?? String(v ?? "");
const statusChange = (d: Record<string, unknown>) =>
  d.from || d.to ? `מ־${status(d.from)} ל־${status(d.to)}` : null;

/** Shared by every action that moves a shift's clock times. */
const describeShiftTimes: Describer = (d, n) => {
  const lines: string[] = [];
  for (const key of ["started_at", "ended_at"]) {
    const change = d[key];
    if (!isObject(change)) continue;
    const line = changeLine(key, change.from, change.to, n);
    if (line) lines.push(line);
  }
  return lines.join(" · ") || "ללא שינוי";
};

/**
 * Per-action sentences. Anything money- or correction-related gets one,
 * because that is what an admin reads this log for.
 */
const DESCRIBERS: Record<string, Describer> = {
  "advance.give": (d, n) =>
    join(
      `${money(d.amount)} ל${d.worker_name ?? who(d.worker_id, n) ?? "עובד"}`,
      method(d.method)
    ),
  "advance.create": (d, n) =>
    join(
      `${money(d.amount)} ל${d.worker_name ?? who(d.worker_id, n) ?? "עובד"}`,
      d.taken_at && formatDate(String(d.taken_at))
    ),
  "advance.update": (d) =>
    `הסכום שונה מ־${money(d.from)} ל־${money(d.to)}`,
  "advance.delete": (d) => `מפרעה על סך ${money(d.amount)} נמחקה`,

  "shift.start_by_manager": (d) =>
    join(String(d.worker_name ?? ""), d.started_at && `כניסה ${toTimeInput(String(d.started_at))}`),
  "shift.end_by_manager": (d) =>
    join(String(d.worker_name ?? ""), d.ended_at && `יציאה ${toTimeInput(String(d.ended_at))}`),
  "shift.update_times": describeShiftTimes,
  "shift.close_by_admin": describeShiftTimes,
  "shift.create": (d) =>
    join(
      String(d.worker_name ?? ""),
      d.started_at && formatDate(String(d.started_at)),
      d.started_at &&
        `${toTimeInput(String(d.started_at))}–${
          d.ended_at ? toTimeInput(String(d.ended_at)) : "פתוחה"
        }`,
      Number(d.days) > 1 && `${d.days} ימים`
    ),
  "shift.delete": (d) =>
    join(
      d.started_at && formatDate(String(d.started_at)),
      d.started_at &&
        `${toTimeInput(String(d.started_at))}–${
          d.ended_at ? toTimeInput(String(d.ended_at)) : "פתוחה"
        }`
    ),
  "shift.bulk_set": (d) =>
    join(
      String(d.worker_name ?? ""),
      d.from && d.to && `${formatDate(String(d.from))}–${formatDate(String(d.to))}`,
      `${d.start_time}–${d.end_time}`,
      `${d.count} ימים`,
      Number(d.skipped) > 0 && `${d.skipped} ימים דולגו`
    ),

  "vendor_order.create": (d, n) =>
    join(
      who(d.vendor_id, n),
      money(d.amount),
      d.paid ? `שולם${method(d.method) ? ` ב${method(d.method)}` : ""}` : "טרם שולם"
    ),
  "vendor_order.update": (d, n) => describeChanges(d, n) || "ללא שינוי",
  "vendor_order.delete": (d, n) => join(who(d.vendor_id, n), money(d.amount)),

  "vendor_payment.create": (d, n) =>
    join(
      who(d.vendor_id, n),
      money(d.amount),
      method(d.method),
      d.vendor_order_id ? "כנגד חשבונית" : "על חשבון החוב"
    ),
  "vendor_payment.update": (d, n) => describeChanges(d, n) || "ללא שינוי",
  "vendor_payment.delete": (d, n) => join(who(d.vendor_id, n), money(d.amount)),

  "private_payment.create": (d) =>
    join(
      d.paid_to ? `ל${d.paid_to}` : null,
      money(d.amount),
      d.date && formatDate(String(d.date))
    ),
  "private_payment.update": (d, n) => describeChanges(d, n) || "ללא שינוי",
  "private_payment.delete": (d) =>
    join(d.paid_to ? `ל${d.paid_to}` : null, money(d.amount)),

  "expense.create": (d) => join(String(d.description ?? ""), money(d.amount)),
  "expense.update": (d, n) => describeChanges(d, n) || "ללא שינוי",
  "expense.delete": (d) =>
    join(
      String(d.description ?? ""),
      money(d.amount),
      d.expense_date && formatDate(String(d.expense_date))
    ),

  // Amounts are deliberately absent from the takings entries: recording
  // them here would put back in the clear exactly what /secret encrypts.
  "daily_sales.save": (d) =>
    join(
      d.sales_date && formatDate(String(d.sales_date)),
      d.left_in_register != null && `נשאר בקופה ${money(d.left_in_register)}`
    ),
  "secret.day_save": (d) =>
    d.sales_date ? formatDate(String(d.sales_date)) : null,
  "day.lock": (d) => (d.date ? formatDate(String(d.date)) : null),
  "day.reopen": (d) => (d.date ? formatDate(String(d.date)) : null),
  "day.end": (d) =>
    join(
      d.sales_date && formatDate(String(d.sales_date)),
      `נשאר בקופה ${money(d.left_in_register)}`,
      Number(d.open_shifts_left) > 0 &&
        `${d.open_shifts_left} משמרות נשארו פתוחות`
    ),

  "order.create": (d) =>
    join(`#${d.order_number}`, money(d.total), d.items && `${d.items} פריטים`),
  "order.delete": (d) =>
    join(
      `#${d.order_number}`,
      money(d.total),
      d.status_before &&
        `סטטוס: ${ORDER_STATUS_LABELS[d.status_before as OrderStatus] ?? d.status_before}`
    ),
  "order.status_change": (d) => join(`#${d.order_number}`, statusChange(d)),
  "order.production_status": (d) => join(`#${d.order_number}`, statusChange(d)),
  "order.shortage": (d) =>
    join(
      `#${d.order_number}`,
      `סה"כ: מ־${money(d.original_total)} ל־${money(d.updated_total)}`,
      d.note && String(d.note)
    ),
  "order.mark_all_ready": (d) => `${d.count ?? 0} הזמנות`,

  "payment.record": (d) => join(money(d.amount), method(d.method)),
  "payment.driver_collect": (d) =>
    join(`#${d.order_number}`, money(d.collected), method(d.method)),
  "payment.driver_collect_multi": (d, n) =>
    join(
      who(d.customer_id, n),
      money(d.amount),
      Array.isArray(d.order_ids) && `${d.order_ids.length} הזמנות`
    ),

  "customer_price.set": (d, n) =>
    join(
      who(d.product_id, n),
      d.price != null && money(d.price),
      d.is_available === false && "לא זמין ללקוח"
    ),
};

// Every delivery outcome logs the same shape.
for (const outcome of ["delivered_paid", "delivered_unpaid", "partial", "failed"]) {
  DESCRIBERS[`delivery.${outcome}`] = (d) =>
    join(
      `#${d.order_number}`,
      Number(d.collected) > 0 && `נגבה ${money(d.collected)}`,
      method(d.method)
    );
}

/** One Hebrew line describing what the logged action did. */
export function describeAudit(
  action: string,
  details: Record<string, unknown> | null,
  names: NameLookup
): string {
  if (!details || Object.keys(details).length === 0) return "";
  const describer = DESCRIBERS[action];
  if (describer) {
    try {
      const line = describer(details, names);
      if (line) return line;
    } catch {
      // A malformed old row must not take the whole page down — fall
      // through to the generic renderer.
    }
  }
  if (isObject(details.from) && isObject(details.to)) {
    const changes = describeChanges(details, names);
    if (changes) return changes;
  }
  return describePairs(details, names);
}

/**
 * The ids the page has to resolve to names before it can describe these
 * rows — every `*_id` in the details, nested from/to included.
 */
export function collectDetailIds(
  details: Record<string, unknown> | null
): string[] {
  if (!details) return [];
  const ids: string[] = [];
  const walk = (obj: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(obj)) {
      if (isObject(value)) walk(value);
      else if (key.endsWith("_id") && typeof value === "string") ids.push(value);
    }
  };
  walk(details);
  return ids;
}
