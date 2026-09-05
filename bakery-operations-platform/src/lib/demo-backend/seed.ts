import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { businessToday } from "@/lib/db/day-lock";
import type { Database, Row } from "./store";

/**
 * The fictional bakery.
 *
 * Every business, person, customer, supplier and figure below is invented for
 * this demo. Nothing here is derived from any real business's records.
 *
 * The dataset is *generated* rather than dumped, and anchored to today, so the
 * app always opens on a live-looking day: orders on the board, a crew on shift,
 * a van on the road. The same DEMO_SEED always produces the same data.
 */

/* ------------------------------ determinism ----------------------------- */

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}
type Random = ReturnType<typeof makeRandom>;
const pick = <T>(rng: Random, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
const between = (rng: Random, min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/* --------------------------------- dates -------------------------------- */

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** An instant at a given Israel-local-ish hour on `date`. */
const at = (date: string, hour: number, minute = 0) =>
  new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+03:00`
  ).toISOString();

/* ------------------------------ the fiction ----------------------------- */

const BUSINESS = {
  name: "מאפיית אורן",
  phone: "050-0000000",
  address: "רחוב הזיתים 12, עיר הדוגמה",
};

const ADMINS = [
  { email: "owner@demo.local", full_name: "אורן ברק", role: "admin" },
  { email: "manager@demo.local", full_name: "שירה לוין", role: "manager" },
];

/** Passcodes are printed on the landing page — they are demo credentials. */
const WORKERS: {
  full_name: string;
  passcode: string;
  hourly_rate: number | null;
  daily_rate?: number | null;
  pay_type?: "hourly" | "daily";
  can_manage_shift?: boolean;
  is_driver?: boolean;
  is_baker?: boolean;
  is_admin?: boolean;
  notes?: string;
}[] = [
  { full_name: "נועה שדה", passcode: "1111", hourly_rate: 52, can_manage_shift: true, is_admin: true, notes: "אחראית משמרת" },
  { full_name: "יונתן כהן", passcode: "1112", hourly_rate: 50, can_manage_shift: true },
  { full_name: "רותם אביב", passcode: "2221", hourly_rate: 55, is_baker: true, notes: "אופה ראשי" },
  { full_name: "סאמר חדאד", passcode: "2222", hourly_rate: 48, is_baker: true },
  { full_name: "ליאור בן־חיים", passcode: "2223", hourly_rate: 46, is_baker: true },
  { full_name: "מאיה גל", passcode: "2224", hourly_rate: 42, is_baker: true, notes: "אריזה" },
  { full_name: "דניאל אשר", passcode: "2225", hourly_rate: 42, is_baker: true, notes: "אריזה" },
  { full_name: "איתי נחום", passcode: "3331", hourly_rate: null, daily_rate: 420, pay_type: "daily", is_driver: true },
  { full_name: "עומר ליבנה", passcode: "3332", hourly_rate: null, daily_rate: 420, pay_type: "daily", is_driver: true },
  { full_name: "טל שרון", passcode: "4441", hourly_rate: 45, can_manage_shift: true, is_driver: true, is_baker: true, notes: "רב־תפקידי" },
];

const CATEGORIES = [
  { name: "מאפים מתוקים", name_ar: "معجنات حلوة", sort_order: 1 },
  { name: "לחמים", name_ar: "خبز", sort_order: 2 },
  { name: "מלוחים", name_ar: "معجنات مالحة", sort_order: 3 },
  { name: "עוגיות ועוגות", name_ar: "بسكويت وكعك", sort_order: 4 },
];

const PRODUCTS: {
  name: string; name_ar: string; category: number; unit_type: string; price: number;
}[] = [
  { name: "קרואסון חמאה", name_ar: "كرواسان زبدة", category: 0, unit_type: "unit", price: 6.5 },
  { name: "קרואסון שוקולד", name_ar: "كرواسان شوكولاتة", category: 0, unit_type: "unit", price: 7.5 },
  { name: "רוגלך שוקולד", name_ar: "روجلاخ شوكولاتة", category: 0, unit_type: "kg", price: 48 },
  { name: "מאפה גבינה", name_ar: "معجنات جبنة", category: 0, unit_type: "unit", price: 8 },
  { name: "עוגת שמרים", name_ar: "كعكة خميرة", category: 0, unit_type: "unit", price: 32 },
  { name: "לחם מחמצת", name_ar: "خبز مخمّر", category: 1, unit_type: "unit", price: 18 },
  { name: "באגט", name_ar: "باغيت", category: 1, unit_type: "unit", price: 9 },
  { name: "חלה", name_ar: "خلة", category: 1, unit_type: "unit", price: 14 },
  { name: "לחמניות המבורגר", name_ar: "خبز برجر", category: 1, unit_type: "package", price: 16 },
  { name: "לחם כפרי", name_ar: "خبز بلدي", category: 1, unit_type: "unit", price: 15 },
  { name: "בורקס תפוחי אדמה", name_ar: "بوريك بطاطا", category: 2, unit_type: "tray", price: 65 },
  { name: "בורקס גבינה", name_ar: "بوريك جبنة", category: 2, unit_type: "tray", price: 70 },
  { name: "פיצה מגש", name_ar: "بيتزا صينية", category: 2, unit_type: "tray", price: 85 },
  { name: "עוגיות שוקולד צ׳יפס", name_ar: "بسكويت شوكولاتة", category: 3, unit_type: "kg", price: 55 },
  { name: "עוגיות חמאה", name_ar: "بسكويت زبدة", category: 3, unit_type: "kg", price: 52 },
];

const CUSTOMERS: {
  name: string; area: string; address: string; lat: number; lng: number;
  terms?: "immediate" | "monthly"; discount?: number; notes?: string;
}[] = [
  { name: "קפה נעים", area: "מרכז", address: "שדרות הדקל 4", lat: 32.7940, lng: 35.0290, terms: "monthly", discount: 0.1 },
  { name: "מכולת השדה", area: "צפון", address: "רחוב הברוש 21", lat: 32.8020, lng: 35.0355, terms: "monthly", discount: 0.08 },
  { name: "מסעדת הזית", area: "מרכז", address: "רחוב הזית 3", lat: 32.7955, lng: 35.0248, terms: "monthly", discount: 0.12 },
  { name: "בית קפה תמר", area: "דרום", address: "רחוב התמר 9", lat: 32.7861, lng: 35.0301, terms: "immediate" },
  { name: "פיצריית סול", area: "מרכז", address: "רחוב האלון 17", lat: 32.7929, lng: 35.0332, terms: "monthly" },
  { name: "קיוסק המרכז", area: "מרכז", address: "כיכר העיר 1", lat: 32.7948, lng: 35.0276, terms: "immediate" },
  { name: "מלון שקד", area: "מערב", address: "דרך החוף 60", lat: 32.7990, lng: 35.0150, terms: "monthly", discount: 0.15, notes: "אספקה לפני 06:30" },
  { name: "קייטרינג נועם", area: "תעשייה", address: "האורגים 8", lat: 32.8065, lng: 35.0442, terms: "monthly", discount: 0.18, notes: "כמויות משתנות לפי אירועים" },
  { name: "גן ילדים פרפר", area: "צפון", address: "רחוב הגפן 5", lat: 32.8038, lng: 35.0311, terms: "monthly" },
  { name: "בית ספר אלון", area: "דרום", address: "רחוב החינוך 2", lat: 32.7845, lng: 35.0265, terms: "monthly", discount: 0.2 },
  { name: "מרקט גל", area: "מערב", address: "רחוב הים 33", lat: 32.7975, lng: 35.0182, terms: "monthly" },
  { name: "בית קפה שחר", area: "מרכז", address: "רחוב הרימון 11", lat: 32.7912, lng: 35.0294, terms: "immediate" },
];

const VENDORS = [
  { name: "טחנות קמח דרום", category: "raw_materials", contact: "אבי מזרחי", low: 1800, high: 4200, every: 4 },
  { name: "מחלבת העמק", category: "raw_materials", contact: "רונית שגב", low: 900, high: 2100, every: 3 },
  { name: "סוכר ותבלינים בע״מ", category: "raw_materials", contact: "חוסאם עלי", low: 400, high: 1200, every: 9 },
  { name: "אריזות פלוס", category: "packaging", contact: "מירי דהן", low: 350, high: 900, every: 12 },
  { name: "גז ודלק מרכז", category: "utilities", contact: "שירות לקוחות", low: 700, high: 1400, every: 21 },
  { name: "שירותי ניקיון זוהר", category: "services", contact: "זוהר פנחס", low: 200, high: 500, every: 7 },
];

const EXPENSE_CATEGORIES = ["דלק", "תחזוקה", "ניקיון", "ציוד קטן", "כיבוד לעובדים", "תיקונים", "משרד"];
const ORDER_STATUSES_PAST = ["delivered", "delivered", "delivered", "delivered", "shortage", "cancelled"];

/* --------------------------------- seed --------------------------------- */

export function seedDatabase(db: Database): void {
  const rng = makeRandom(Number(process.env.DEMO_SEED ?? 20260101) || 20260101);
  // The bakery's day rolls over at 02:00, not midnight — see `db/day-lock.ts`.
  // The seed has to anchor to the *same* day the screens ask for, or between
  // midnight and 02:00 every board is empty: the app looks for the trading
  // night that is still running while the data sits on tomorrow's date.
  const today = businessToday();
  const firstDay = addDays(today, -56);
  const lastDay = addDays(today, 2);

  const businessId = randomUUID();
  db.businesses.push({
    id: businessId,
    name: BUSINESS.name,
    phone: BUSINESS.phone,
    address: BUSINESS.address,
    logo_url: null,
    settings: {},
    next_order_number: 1001,
    next_delivery_public_seq: 1,
    created_at: at(firstDay, 8),
    updated_at: at(today, 8),
  });

  for (const admin of ADMINS) {
    db.profiles.push({
      id: randomUUID(),
      business_id: businessId,
      email: admin.email,
      full_name: admin.full_name,
      role: admin.role,
      is_active: true,
      created_at: at(firstDay, 8),
      updated_at: at(firstDay, 8),
    });
  }

  // Cost 8 keeps the seed fast; the login path is a real bcrypt.compare either way.
  const workers = WORKERS.map((worker) => ({
    id: randomUUID(),
    business_id: businessId,
    full_name: worker.full_name,
    phone: null,
    passcode_hash: bcrypt.hashSync(worker.passcode, 8),
    hourly_rate: worker.hourly_rate,
    daily_rate: worker.daily_rate ?? null,
    pay_type: worker.pay_type ?? "hourly",
    can_manage_shift: worker.can_manage_shift ?? false,
    is_driver: worker.is_driver ?? false,
    is_baker: worker.is_baker ?? false,
    is_admin: worker.is_admin ?? false,
    notes: worker.notes ?? null,
    is_active: true,
    created_at: at(firstDay, 8),
    updated_at: at(firstDay, 8),
  }));
  db.workers.push(...workers);
  const drivers = workers.filter((w) => w.is_driver);
  const managers = workers.filter((w) => w.can_manage_shift);

  const categories = CATEGORIES.map((category) => ({
    id: randomUUID(),
    business_id: businessId,
    name: category.name,
    name_ar: category.name_ar,
    sort_order: category.sort_order,
    is_active: true,
    menu_note: null,
    created_at: at(firstDay, 8),
  }));
  db.product_categories.push(...categories);

  const products = PRODUCTS.map((product, index) => ({
    id: randomUUID(),
    business_id: businessId,
    category_id: categories[product.category]!.id,
    name: product.name,
    name_ar: product.name_ar,
    menu_description: null,
    unit_type: product.unit_type,
    default_price: product.price,
    sort_order: index,
    available_for_online_ordering: true,
    is_active: true,
    created_at: at(firstDay, 8),
    updated_at: at(firstDay, 8),
  }));
  db.products.push(...products);

  const customers = CUSTOMERS.map((customer) => ({
    id: randomUUID(),
    business_id: businessId,
    name: customer.name,
    phone: `05${between(rng, 0, 8)}-${between(rng, 1000000, 9999999)}`,
    customer_type: "business",
    payment_terms: customer.terms ?? "monthly",
    notes: customer.notes ?? null,
    can_order_online: false,
    show_debt_in_portal: false,
    is_active: true,
    receipt: null,
    created_at: at(firstDay, 8),
    updated_at: at(firstDay, 8),
  }));
  db.customers.push(...customers);

  CUSTOMERS.forEach((source, index) => {
    db.customer_addresses.push({
      id: randomUUID(),
      business_id: businessId,
      customer_id: customers[index]!.id,
      label: "ראשי",
      address_text: source.address,
      city: "עיר הדוגמה",
      area: source.area,
      latitude: source.lat,
      longitude: source.lng,
      is_default: true,
      notes: source.notes ?? null,
      created_at: at(firstDay, 8),
    });
    if (source.discount) {
      for (const product of products) {
        if (rng() < 0.5) continue;
        db.customer_product_prices.push({
          id: randomUUID(),
          business_id: businessId,
          customer_id: customers[index]!.id,
          product_id: product.id,
          price: round2(product.default_price * (1 - source.discount)),
          is_available_to_customer: true,
          created_at: at(firstDay, 8),
          updated_at: at(firstDay, 8),
        });
      }
    }
  });

  /* ------------------------------- orders ------------------------------- */

  const priceFor = (customerId: string, product: Row) => {
    const override = db.customer_product_prices.find(
      (row) => row.customer_id === customerId && row.product_id === product.id
    );
    return Number(override?.price ?? product.default_price);
  };

  let orderNumber = 1000;
  let deliverySeq = 0;
  const codeCounters = new Map<string, number>();

  for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const isFuture = day > today;
    const isToday = day === today;
    // Saturday is quiet and Friday is busy — real trading rhythm, and worth
    // keeping in the history so the revenue chart has a shape.
    //
    // Today and tomorrow are exempt: the demo is anchored to whenever someone
    // opens it, and landing on a Saturday to find an empty driver app and an
    // empty bench teaches a reviewer nothing about the system.
    const dayWeight =
      isToday || isFuture ? 1.15 : weekday === 6 ? 0.4 : weekday === 5 ? 1.2 : 1;

    customers.forEach((customer, index) => {
      const frequency = [0.9, 0.8, 0.75, 0.5, 0.6, 0.55, 0.7, 0.35, 0.45, 0.4, 0.65, 0.5][index] ?? 0.5;
      if (rng() > frequency * dayWeight) return;

      const basket = [...products].sort(() => rng() - 0.5).slice(0, between(rng, 2, 6));
      if (basket.length === 0) return;

      orderNumber += 1;
      const orderId = randomUUID();
      const isPickup = index === 5 || index === 11;
      const codeKey = `${day}:${isPickup ? "t" : "d"}`;
      const seq = (codeCounters.get(codeKey) ?? 0) + 1;
      codeCounters.set(codeKey, seq);
      const code = String.fromCharCode(65 + Math.floor((seq - 1) / 9)) + (((seq - 1) % 9) + 1);

      const status = isFuture
        ? rng() < 0.5 ? "new" : "preparing"
        : isToday
          // Weighted so most of today is still open: a driver app with nothing
          // left to deliver is a screen that demonstrates nothing.
          ? pick(rng, [
              "new", "preparing", "preparing",
              "ready", "ready", "ready",
              "delivering", "delivering",
              "delivered", "shortage",
            ])
          : pick(rng, ORDER_STATUSES_PAST);

      const items = basket.map((product) => {
        const quantity =
          product.unit_type === "kg" ? between(rng, 1, 6)
          : product.unit_type === "tray" ? between(rng, 1, 4)
          : between(rng, 5, 40);
        const unitPrice = priceFor(customer.id, product);
        return { product, quantity, unitPrice, lineTotal: round2(unitPrice * quantity) };
      });

      let total = round2(items.reduce((sum, line) => sum + line.lineTotal, 0));
      const originalTotal = total;
      const placedAt = at(addDays(day, -1), between(rng, 9, 19), between(rng, 0, 59));
      const hasShortage = status === "shortage";

      for (const line of items) {
        const originalQuantity = line.quantity;
        if (hasShortage && rng() < 0.5) {
          line.quantity = Math.max(0, line.quantity - between(rng, 1, 3));
          line.lineTotal = round2(line.quantity * line.unitPrice);
        }
        db.order_items.push({
          id: randomUUID(),
          business_id: businessId,
          order_id: orderId,
          product_id: line.product.id,
          product_name: line.product.name,
          product_name_ar: line.product.name_ar,
          unit_type: line.product.unit_type,
          quantity: line.quantity,
          original_quantity: hasShortage ? originalQuantity : null,
          unit_price: line.unitPrice,
          line_total: line.lineTotal,
          notes: null,
          created_at: placedAt,
        });
      }
      if (hasShortage) total = round2(items.reduce((sum, line) => sum + line.lineTotal, 0));

      const paid = status === "delivered" && (customer.payment_terms === "immediate" ? rng() < 0.95 : rng() < 0.55);

      db.orders.push({
        id: orderId,
        business_id: businessId,
        customer_id: customer.id,
        order_number: orderNumber,
        status,
        payment_status: paid ? "paid" : "unpaid",
        delivery_type: isPickup ? "pickup" : "delivery",
        delivery_code: code,
        public_delivery_id: isPickup ? null : `D-${String(++deliverySeq).padStart(6, "0")}`,
        delivery_date: day,
        delivery_time: pick(rng, ["05:30-07:00", "06:00-08:00", "07:00-09:00", null]),
        address_text: isPickup ? null : CUSTOMERS[index]!.address,
        total,
        original_total: originalTotal,
        updated_total: total,
        has_shortage: hasShortage,
        shortage_note: hasShortage ? "חוסר בייצור — עודכן לפי מה שנארז" : null,
        notes: null,
        notes_for_baker: rng() < 0.12 ? "אפייה בהירה" : null,
        notes_for_driver: rng() < 0.1 ? "להתקשר בהגעה" : null,
        receipt: null,
        source: "admin",
        created_by_type: "admin",
        created_by_id: null,
        created_at: placedAt,
        updated_at: placedAt,
      });

      if (status !== "cancelled" && !isFuture) {
        db.customer_ledger_entries.push({
          id: randomUUID(),
          business_id: businessId,
          customer_id: customer.id,
          entry_type: "charge",
          amount: total,
          order_id: orderId,
          payment_id: null,
          description: `הזמנה #${orderNumber}`,
          created_at: at(day, 7),
        });
      }

      if (paid) {
        const paymentId = randomUUID();
        db.payments.push({
          id: paymentId,
          business_id: businessId,
          customer_id: customer.id,
          order_id: orderId,
          delivery_id: null,
          amount: total,
          method: pick(rng, ["cash", "transfer", "card"]),
          collected_by_type: "worker",
          collected_by_id: pick(rng, drivers).id,
          proof_file_path: null,
          notes: null,
          paid_at: at(day, 8, between(rng, 0, 59)),
          created_at: at(day, 8),
        });
        db.customer_ledger_entries.push({
          id: randomUUID(),
          business_id: businessId,
          customer_id: customer.id,
          entry_type: "payment",
          amount: total,
          order_id: orderId,
          payment_id: paymentId,
          description: `תשלום להזמנה #${orderNumber}`,
          created_at: at(day, 8, 1),
        });
      }
    });
  }

  db.businesses[0]!.next_order_number = orderNumber + 1;
  db.businesses[0]!.next_delivery_public_seq = deliverySeq + 1;

  /* ------------------------------ deliveries ---------------------------- */

  // There is no assignment step in this system. Any worker with a passcode
  // opens the driver app and sees every open delivery for the day, and the
  // `delivery_orders` row — with who completed it — is written *at completion*
  // (see migration 0010 and `driver/actions.ts`).
  //
  // So a stop that has not been delivered yet must have NO row at all. Seeding
  // "pending" rows looks harmless and is not: the completion action treats an
  // existing row as proof the stop is already done, and refuses every delivery
  // on today's run with "המשלוח כבר הושלם".
  for (let day = addDays(today, -6); day <= today; day = addDays(day, 1)) {
    const delivered = db.orders.filter(
      (order) =>
        order.delivery_date === day &&
        order.delivery_type === "delivery" &&
        order.status === "delivered"
    );
    if (delivered.length === 0) continue;

    const deliveryId = randomUUID();
    db.deliveries.push({
      id: deliveryId,
      business_id: businessId,
      // Nullable since 0010: the container is opened by whoever completes the
      // first stop of the day, not assigned to a driver in advance.
      driver_worker_id: null,
      delivery_date: day,
      status: day < today ? "done" : "in_progress",
      notes: null,
      created_by: null,
      created_at: at(day, 5),
    });

    delivered.forEach((order, index) => {
      const paid = order.payment_status === "paid";
      const completedBy = pick(rng, drivers);
      db.delivery_orders.push({
        id: randomUUID(),
        business_id: businessId,
        delivery_id: deliveryId,
        order_id: order.id,
        sort_order: index + 1,
        status: paid ? "delivered_paid" : "delivered_unpaid",
        collected_amount: paid ? Number(order.total) : 0,
        payment_method: paid ? "cash" : null,
        proof_file_path: null,
        driver_notes: null,
        completed_at: at(day, 7, between(rng, 0, 59)),
        completed_by_worker_id: completedBy.id,
        created_at: at(day, 7),
      });
    });
  }

  /* -------------------------------- shifts ------------------------------ */

  for (let day = addDays(today, -21); day <= today; day = addDays(day, 1)) {
    const manager = pick(rng, managers);
    const onShift = workers.filter(() => rng() < 0.7);
    for (const worker of onShift) {
      const stillOpen = day === today && rng() < 0.6;
      const length = worker.is_baker ? between(rng, 7, 9) : between(rng, 5, 8);
      // An open shift has to look like somebody who is actually here now, not
      // one that started at dawn and has been running for nineteen hours —
      // which is what the board flags as "somebody forgot to clock out".
      const startedAt = stillOpen
        ? new Date(Date.now() - between(rng, 1, 6) * 3_600_000 - between(rng, 0, 55) * 60_000).toISOString()
        : at(day, worker.is_baker ? between(rng, 2, 5) : between(rng, 5, 8), between(rng, 0, 55));
      db.worker_shifts.push({
        id: randomUUID(),
        business_id: businessId,
        worker_id: worker.id,
        started_at: startedAt,
        ended_at: stillOpen ? null : new Date(Date.parse(startedAt) + length * 3_600_000).toISOString(),
        started_by_type: "worker",
        started_by_id: manager.id,
        started_via: "kiosk",
        ended_by_type: stillOpen ? null : "worker",
        ended_by_id: stillOpen ? null : manager.id,
        notes: null,
        created_at: startedAt,
      });
    }
    if (rng() < 0.35) {
      const worker = pick(rng, workers);
      db.worker_advances.push({
        id: randomUUID(),
        business_id: businessId,
        worker_id: worker.id,
        amount: between(rng, 100, 800),
        method: "cash",
        taken_at: at(day, between(rng, 8, 17)),
        given_by_type: "worker",
        given_by_id: pick(rng, managers).id,
        given_by_worker_id: pick(rng, managers).id,
        shift_id: null,
        notes: null,
        created_at: at(day, 12),
      });
    }
  }

  /* ------------------------------- vendors ------------------------------ */

  const vendors = VENDORS.map((vendor) => ({
    id: randomUUID(),
    business_id: businessId,
    name: vendor.name,
    category: vendor.category,
    contact_name: vendor.contact,
    phone: `04-${between(rng, 6000000, 6999999)}`,
    notes: null,
    is_active: true,
    created_at: at(firstDay, 8),
    updated_at: at(firstDay, 8),
  }));
  db.vendors.push(...vendors);

  VENDORS.forEach((source, index) => {
    const vendor = vendors[index]!;
    for (let day = firstDay; day <= today; day = addDays(day, source.every)) {
      const amount = between(rng, source.low, source.high);
      const receivedAt = at(day, between(rng, 5, 12), between(rng, 0, 59));
      const orderId = randomUUID();
      const paidAtArrival = rng() < 0.55;

      db.vendor_orders.push({
        id: orderId,
        business_id: businessId,
        vendor_id: vendor.id,
        amount,
        status: paidAtArrival ? "paid" : "unpaid",
        payment_method: paidAtArrival ? "cash" : null,
        paid_by_worker_id: paidAtArrival ? pick(rng, managers).id : null,
        received_by_type: "worker",
        received_by_id: pick(rng, managers).id,
        receipt_file_path: null,
        notes: null,
        received_at: receivedAt,
        created_at: receivedAt,
      });
      db.vendor_ledger_entries.push({
        id: randomUUID(),
        business_id: businessId,
        vendor_id: vendor.id,
        entry_type: "charge",
        amount,
        vendor_order_id: orderId,
        vendor_payment_id: null,
        description: "קבלת סחורה",
        created_at: receivedAt,
      });

      if (paidAtArrival) {
        const paymentId = randomUUID();
        db.vendor_payments.push({
          id: paymentId,
          business_id: businessId,
          vendor_id: vendor.id,
          vendor_order_id: orderId,
          amount,
          method: "cash",
          paid_by_type: "worker",
          paid_by_id: pick(rng, managers).id,
          proof_file_path: null,
          notes: null,
          at_arrival: true,
          paid_at: receivedAt,
          created_at: receivedAt,
        });
        db.vendor_ledger_entries.push({
          id: randomUUID(),
          business_id: businessId,
          vendor_id: vendor.id,
          entry_type: "payment",
          amount,
          vendor_order_id: orderId,
          vendor_payment_id: paymentId,
          description: "תשלום בעת קבלת סחורה",
          created_at: receivedAt,
        });
      } else if (rng() < 0.5) {
        const paidAt = at(addDays(day, between(rng, 1, 10)), 15);
        if (paidAt.slice(0, 10) > today) continue;
        const paymentId = randomUUID();
        db.vendor_payments.push({
          id: paymentId,
          business_id: businessId,
          vendor_id: vendor.id,
          vendor_order_id: orderId,
          amount,
          method: pick(rng, ["transfer", "check", "cash"]),
          paid_by_type: "admin",
          paid_by_id: null,
          proof_file_path: null,
          notes: null,
          at_arrival: false,
          paid_at: paidAt,
          created_at: paidAt,
        });
        db.vendor_ledger_entries.push({
          id: randomUUID(),
          business_id: businessId,
          vendor_id: vendor.id,
          entry_type: "payment",
          amount,
          vendor_order_id: orderId,
          vendor_payment_id: paymentId,
          description: "תשלום חוב לספק",
          created_at: paidAt,
        });
        const order = db.vendor_orders.find((row) => row.id === orderId);
        if (order) order.status = "paid";
      }
    }
  });

  /* ------------------------- expenses and takings ----------------------- */

  for (let day = addDays(today, -35); day <= today; day = addDays(day, 1)) {
    for (let n = 0; n < between(rng, 0, 3); n++) {
      db.expenses.push({
        id: randomUUID(),
        business_id: businessId,
        category: pick(rng, EXPENSE_CATEGORIES),
        amount: between(rng, 30, 900),
        method: pick(rng, ["cash", "card", "transfer"]),
        description: null,
        receipt_file_path: null,
        spent_by_type: "worker",
        spent_by_id: pick(rng, managers).id,
        expense_date: day,
        created_at: at(day, between(rng, 6, 20), between(rng, 0, 59)),
      });
    }
    if (day < today) {
      db.daily_sales.push({
        id: randomUUID(),
        business_id: businessId,
        sales_date: day,
        cash_total: between(rng, 1200, 4800),
        card_total: between(rng, 800, 3600),
        other_total: 0,
        left_in_register: between(rng, 200, 600),
        sales_cipher: null,
        notes: null,
        created_by: null,
        created_at: at(day, 23),
        updated_at: at(day, 23),
      });
    }
  }

  /* ---------------------------- attendance ----------------------------- */

  // The geofence the second site clocks in against. Fictional coordinates.
  db.attendance_settings.push({
    business_id: businessId,
    latitude: 32.7955,
    longitude: 35.0248,
    radius_m: 150,
    allowed_ips: [],
    is_active: true,
    updated_at: at(today, 8),
    updated_by: null,
  });

  /* ------------------------------- audit -------------------------------- */

  // A fortnight of activity, so the log opens on something to read rather than
  // a single "seeded" row.
  const AUDIT_ACTIONS: [string, string, string][] = [
    ["order.create", "order", "נוצרה הזמנה"],
    ["order.status", "order", "עודכן סטטוס הזמנה"],
    ["vendor_order.create", "vendor_order", "נרשמה קבלת סחורה"],
    ["vendor_payment.create", "vendor_payment", "נרשם תשלום לספק"],
    ["expense.create", "expense", "נרשמה הוצאה"],
    ["shift.start", "worker_shift", "התחלת משמרת"],
    ["shift.end", "worker_shift", "סיום משמרת"],
    ["advance.create", "worker_advance", "נרשמה מקדמה"],
    ["customer.update", "customer", "עודכנו פרטי לקוח"],
    ["product.update", "product", "עודכן מחיר מוצר"],
  ];
  for (let day = addDays(today, -13); day <= today; day = addDays(day, 1)) {
    for (let n = 0; n < between(rng, 3, 9); n++) {
      const [action, entity, summary] = pick(rng, AUDIT_ACTIONS);
      const byAdmin = rng() < 0.4;
      const actor = byAdmin ? ADMINS[0]! : pick(rng, workers);
      db.audit_logs.push({
        id: randomUUID(),
        business_id: businessId,
        actor_type: byAdmin ? "admin" : "worker",
        actor_id: null,
        actor_name: byAdmin ? actor.full_name : (actor as { full_name: string }).full_name,
        affected_worker_id: null,
        action,
        entity_type: entity,
        entity_id: null,
        details: { summary },
        created_at: at(day, between(rng, 5, 21), between(rng, 0, 59)),
      });
    }
  }

  db.audit_logs.push({
    id: randomUUID(),
    business_id: businessId,
    actor_type: "system",
    actor_id: null,
    actor_name: "מערכת הדגמה",
    affected_worker_id: null,
    action: "demo.seeded",
    entity_type: "system",
    entity_id: null,
    details: { orders: db.orders.length, customers: customers.length },
    created_at: at(today, 4),
  });
}

/** Demo credentials, surfaced on the landing page. */
export const DEMO_CREDENTIALS = {
  admins: ADMINS.map((admin) => ({ email: admin.email, name: admin.full_name })),
  workers: WORKERS.map((worker) => ({
    name: worker.full_name,
    passcode: worker.passcode,
    roles: [
      worker.can_manage_shift ? "אחראי משמרת" : null,
      worker.is_baker ? "אופה" : null,
      worker.is_driver ? "נהג" : null,
    ].filter(Boolean) as string[],
  })),
};
