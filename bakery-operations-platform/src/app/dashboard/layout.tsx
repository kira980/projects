import { requireAdmin, getCurrentBusiness } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();
  const business = await getCurrentBusiness();

  return (
    <DashboardShell businessName={business.name} userName={profile.full_name}>
      {children}
    </DashboardShell>
  );
}
