import * as React from "react";
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Truck,
  PackageCheck,
  AlertTriangle,
  XCircle,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/order-status";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const ORDER_META: Record<
  OrderStatus,
  { variant: BadgeVariant; icon: LucideIcon }
> = {
  new: { variant: "info", icon: CircleDashed },
  preparing: { variant: "warning", icon: ChefHat },
  ready: { variant: "info", icon: PackageCheck },
  delivering: { variant: "info", icon: Truck },
  delivered: { variant: "success", icon: CheckCircle2 },
  problem: { variant: "destructive", icon: AlertTriangle },
  cancelled: { variant: "secondary", icon: XCircle },
  shortage: { variant: "warning", icon: AlertTriangle },
};

const PAYMENT_META: Record<
  PaymentStatus,
  { variant: BadgeVariant; icon: LucideIcon }
> = {
  paid: { variant: "success", icon: CheckCircle2 },
  partial: { variant: "warning", icon: Clock },
  unpaid: { variant: "destructive", icon: XCircle },
};

/** Colored, icon-led badge for an order's fulfilment status. */
export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const meta = ORDER_META[status] ?? ORDER_META.new;
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className={className}>
      <Icon aria-hidden />
      {ORDER_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

/** Colored, icon-led badge for a payment status. */
export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const meta = PAYMENT_META[status] ?? PAYMENT_META.unpaid;
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className={className}>
      <Icon aria-hidden />
      {PAYMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
