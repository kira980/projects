import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { DriverLoginScreen } from "./login-screen";

export default async function DriverPage() {
  const session = await getWorkerSession("driver");
  if (session) redirect("/driver/orders");
  return <DriverLoginScreen />;
}
