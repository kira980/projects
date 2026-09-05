/** Client-safe order status metadata. */

export const ORDER_STATUSES = [
  "new",
  "preparing",
  "ready",
  "delivering",
  "delivered",
  "problem",
  "cancelled",
  "shortage",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "חדשה",
  preparing: "בהכנה",
  ready: "מוכנה",
  delivering: "במשלוח",
  delivered: "נמסרה",
  problem: "בעיה",
  cancelled: "בוטלה",
  shortage: "ناقص (חוסר)",
};

export type PaymentStatus = "unpaid" | "partial" | "paid";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "לא שולם",
  partial: "שולם חלקית",
  paid: "שולם",
};

export const PAYMENT_METHODS = [
  { value: "cash", label: "מזומן" },
  { value: "card", label: "אשראי" },
  { value: "transfer", label: "העברה" },
  { value: "check", label: "צ'ק" },
  { value: "other", label: "אחר" },
] as const;

export const UNIT_TYPE_LABELS: Record<string, string> = {
  unit: "יחידה",
  kg: 'ק"ג',
  tray: "מגש",
  box: "ארגז",
  package: "חבילה",
};
