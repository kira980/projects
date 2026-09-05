import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { PasscodeScreen } from "./passcode-screen";

export default async function KioskPage() {
  const session = await getWorkerSession("kiosk");
  if (session) redirect("/workers/menu");
  return <PasscodeScreen />;
}
