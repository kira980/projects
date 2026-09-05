import { requireAdmin } from "@/lib/auth";
import { MenuLauncher } from "./menu-launcher";

export const metadata = { title: "תפריט" };

export default async function MenuPage() {
  await requireAdmin();
  return <MenuLauncher />;
}
