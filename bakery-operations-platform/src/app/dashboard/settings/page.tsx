import { getCurrentBusiness } from "@/lib/auth";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "הגדרות" };

export default async function SettingsPage() {
  const business = await getCurrentBusiness();
  return <SettingsClient business={business} />;
}
