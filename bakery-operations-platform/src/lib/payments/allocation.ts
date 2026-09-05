/**
 * Pure logic for allocating a single customer payment across one or more
 * unpaid / partially-paid orders (driver "pay customer debt" flow).
 */

export type PayableOrder = {
  id: string;
  orderNumber: number;
  /** Order total. */
  total: number;
  /** Already paid toward this order. */
  paid: number;
};

export type OrderRemaining = PayableOrder & {
  /** Outstanding balance, never negative. */
  remaining: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function withRemaining(order: PayableOrder): OrderRemaining {
  return { ...order, remaining: Math.max(0, round2(order.total - order.paid)) };
}

/** Orders that still owe money (remaining > 0). */
export function outstandingOrders(orders: PayableOrder[]): OrderRemaining[] {
  return orders.map(withRemaining).filter((o) => o.remaining > 0);
}

/** Sum of remaining balances for the selected order ids. */
export function selectedRemaining(
  orders: PayableOrder[],
  selectedIds: string[]
): number {
  const set = new Set(selectedIds);
  return round2(
    outstandingOrders(orders)
      .filter((o) => set.has(o.id))
      .reduce((sum, o) => sum + o.remaining, 0)
  );
}

export type Allocation = { orderId: string; amount: number };

export type AllocationResult =
  | { ok: true; allocations: Allocation[]; total: number }
  | { ok: false; error: string };

/**
 * Allocate `amount` across the selected orders, filling each order's
 * remaining balance in the given order. Rejects overpayment (amount that
 * exceeds the combined remaining) and empty/invalid input. This is what
 * prevents overpaying and selecting already-paid orders.
 */
export function allocatePayment(
  orders: PayableOrder[],
  selectedIds: string[],
  amount: number
): AllocationResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "יש להזין סכום" };
  }
  if (selectedIds.length === 0) {
    return { ok: false, error: "יש לבחור לפחות הזמנה אחת" };
  }

  const byId = new Map(outstandingOrders(orders).map((o) => [o.id, o]));
  const selected: OrderRemaining[] = [];
  for (const id of selectedIds) {
    const o = byId.get(id);
    if (!o) return { ok: false, error: "אחת ההזמנות שנבחרו כבר שולמה" };
    selected.push(o);
  }

  const capacity = round2(selected.reduce((s, o) => s + o.remaining, 0));
  if (round2(amount) > capacity) {
    return { ok: false, error: "הסכום גבוה מהחוב שנבחר" };
  }

  let left = round2(amount);
  const allocations: Allocation[] = [];
  for (const o of selected) {
    if (left <= 0) break;
    const take = Math.min(o.remaining, left);
    if (take > 0) {
      allocations.push({ orderId: o.id, amount: round2(take) });
      left = round2(left - take);
    }
  }

  return { ok: true, allocations, total: round2(amount) };
}
