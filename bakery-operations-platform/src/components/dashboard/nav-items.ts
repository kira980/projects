import {
  Gauge,
  ShoppingCart,
  ShoppingBag,
  Users,
  UserRound,
  Package,
  UtensilsCrossed,
  Truck,
  Store,
  Receipt,
  Wallet,
  BarChart3,
  ScrollText,
  Settings,
  MapPin,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/**
 * Navigation grouped into plain-language sections so a non-technical
 * owner can find things by what they want to do, not by feature name.
 */
export const navGroups: NavGroup[] = [
  {
    label: "היום",
    items: [
      { title: "מבט יומי", href: "/dashboard/simple", icon: Gauge },
      { title: "יומן פעולות", href: "/dashboard/audit", icon: ScrollText },
      { title: "הזמנות", href: "/dashboard/orders", icon: ShoppingCart },
      { title: "משלוחים", href: "/dashboard/deliveries", icon: Truck },
      { title: "איסוף עצמי", href: "/dashboard/takeaway", icon: ShoppingBag },
    ],
  },
  {
    label: "ניהול",
    items: [
      { title: "לקוחות", href: "/dashboard/customers", icon: UserRound },
      { title: "מוצרים", href: "/dashboard/products", icon: Package },
      { title: "תפריט", href: "/dashboard/menu", icon: UtensilsCrossed },
      { title: "עובדים", href: "/dashboard/workers", icon: Users },
      { title: "ספקים", href: "/dashboard/vendors", icon: Store },
    ],
  },
  {
    label: "כספים",
    items: [
      { title: "הוצאות", href: "/dashboard/expenses", icon: Receipt },
      { title: "תשלומים פרטיים", href: "/dashboard/private-payments", icon: Wallet },
      { title: "דוחות", href: "/dashboard/reports", icon: BarChart3 },
    ],
  },
  {
    label: "מערכת",
    items: [
      { title: "נוכחות ומיקום", href: "/dashboard/attendance", icon: MapPin },
      { title: "הגדרות", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

/** Flat list, kept for any consumer that needs every destination. */
export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);
