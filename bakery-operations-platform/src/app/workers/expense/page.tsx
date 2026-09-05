import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { ExpenseClient } from "./expense-client";

export default async function KioskExpensePage() {
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");
  return <ExpenseClient />;
}
