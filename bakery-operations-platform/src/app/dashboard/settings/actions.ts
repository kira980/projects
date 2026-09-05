"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";

export type ActionResult = { ok: boolean; error?: string };

export async function updateBusiness(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "יש להזין שם עסק" };

  const { error } = await supabase
    .from("businesses")
    .update({
      name,
      phone: String(formData.get("phone") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
    })
    .eq("id", admin.business_id);

  if (error) return { ok: false, error: "שמירת הפרטים נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "business.update",
    entityType: "business",
    entityId: admin.business_id,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
