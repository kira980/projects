/**
 * Table metadata for the in-memory demo backend.
 *
 * The application talks to this backend through exactly the same client
 * interface it used against PostgreSQL, so it needs to know two things the
 * real database knew implicitly: which columns get default values on insert,
 * and how to resolve an embedded relation like `customers(name)`.
 */

/** Every table the application reads or writes. */
export const TABLES = [
  "businesses",
  "profiles",
  "workers",
  "customers",
  "customer_addresses",
  "customer_product_prices",
  "product_categories",
  "products",
  "vendors",
  "vendor_orders",
  "vendor_payments",
  "vendor_ledger_entries",
  "expenses",
  "orders",
  "order_items",
  "order_documents",
  "payments",
  "customer_ledger_entries",
  "deliveries",
  "delivery_orders",
  "worker_shifts",
  "worker_advances",
  "daily_sales",
  "day_locks",
  "audit_logs",
  "uploaded_files",
  "push_subscriptions",
  "android_devices",
  "worker_devices",
  "worker_attendance",
  "auth_throttle",
  "private_payments",
  "customer_users",
  "attendance_settings",
  "device_enrollments",
  "android_print_logs",
  "payment_allocations",
  "sales_encryption",
] as const;

export type TableName = (typeof TABLES)[number];

/**
 * Two relations the application queries are PostgreSQL **views**, not tables:
 * a customer's debt and a vendor's debt are each the signed sum of their
 * ledger. They are computed on read here for the same reason they were views
 * there — a balance is derived, never stored.
 */
export const VIEWS = ["customer_debts", "vendor_debts"] as const;
export type ViewName = (typeof VIEWS)[number];

/**
 * Columns the database filled in for us. Everything the application sets
 * explicitly is left alone; these only apply when a column is absent.
 */
export const DEFAULTS: Partial<Record<TableName, Record<string, unknown>>> = {
  orders: {
    status: "new",
    payment_status: "unpaid",
    delivery_type: "delivery",
    source: "admin",
    created_by_type: "admin",
    total: 0,
    has_shortage: false,
  },
  order_items: { notes: null },
  workers: {
    is_active: true,
    can_manage_shift: false,
    is_driver: false,
    is_baker: false,
    is_admin: false,
    pay_type: "hourly",
  },
  customers: {
    is_active: true,
    customer_type: "business",
    payment_terms: "immediate",
    can_order_online: false,
    show_debt_in_portal: false,
  },
  products: { is_active: true, unit_type: "unit", default_price: 0, sort_order: 0 },
  vendors: { is_active: true },
  vendor_orders: { status: "unpaid", received_by_type: "worker" },
  vendor_payments: { paid_by_type: "worker", at_arrival: false },
  expenses: { method: "cash", category: "general", spent_by_type: "worker" },
  deliveries: { status: "assigned" },
  delivery_orders: { status: "pending", collected_amount: 0, sort_order: 0 },
  worker_shifts: { started_by_type: "worker" },
  worker_advances: { method: "cash", given_by_type: "worker" },
  day_locks: { is_locked: true },
  audit_logs: { details: {} },
  daily_sales: { cash_total: 0, card_total: 0, other_total: 0 },
  payments: { collected_by_type: "admin" },
};

/** Columns that are stamped with the current time when a row is created. */
export const CREATED_AT_COLUMNS = ["created_at"];

/**
 * Columns that PostgreSQL filled with `now()` when the application omitted
 * them, beyond `created_at`.
 *
 * These are not cosmetic. `payments.paid_at` is what every "collected today"
 * figure filters on, and the driver's own action inserts a payment without
 * setting it — so leaving it null made the driver's takings read €0 straight
 * after they took the money.
 *
 * "date" columns get YYYY-MM-DD in the business's timezone; the rest get a
 * full ISO instant.
 */
export const NOW_DEFAULTS: Record<string, Record<string, "timestamp" | "date">> = {
  payments: { paid_at: "timestamp" },
  vendor_orders: { received_at: "timestamp" },
  vendor_payments: { paid_at: "timestamp" },
  worker_advances: { taken_at: "timestamp" },
  worker_shifts: { started_at: "timestamp" },
  day_locks: { locked_at: "timestamp" },
  android_print_logs: { printed_at: "timestamp" },
  expenses: { expense_date: "date" },
  private_payments: { paid_on: "date" },
};
/** Columns refreshed on every write, as the `set_updated_at` trigger did. */
export const UPDATED_AT_COLUMNS = ["updated_at"];

/**
 * Tables that carry an `updated_at`. Setting the column on a table that never
 * had one would show up in the UI as a stray field.
 */
export const HAS_UPDATED_AT = new Set<string>([
  "businesses",
  "profiles",
  "workers",
  "customers",
  "products",
  "customer_product_prices",
  "vendors",
  "orders",
  "daily_sales",
]);

/**
 * Turns an embedded relation name into the foreign-key stem PostgREST would
 * have used: `customers(name)` on an order resolves through `customer_id`.
 */
export function singularize(table: string): string {
  if (table.endsWith("ies")) return `${table.slice(0, -3)}y`;
  if (/(ses|shes|ches|xes)$/.test(table)) return table.slice(0, -2);
  if (table.endsWith("s")) return table.slice(0, -1);
  return table;
}
