import { createServiceClient } from "@/lib/supabase/service"
import { sendBusinessPushNotification, sendWaitlistCustomerPush } from "@/lib/push/send"
import { sendWaitlistSlotOpen } from "@/lib/whatsapp"
import { logWaMessage } from "@/lib/wa-log"

function getEraForTime(time: string): "morning" | "noon" | "evening" | null {
  const [h] = time.split(":").map(Number)
  if (h >= 6 && h < 12) return "morning"
  if (h >= 12 && h < 17) return "noon"
  if (h >= 17 && h < 22) return "evening"
  return null
}

const DAY_NAMES: Record<string, string[]> = {
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
}

export async function notifyWaitlistOnSlotOpen(
  businessId: string,
  _serviceId: string,
  appointmentDate: string,
  serviceName?: string,
  startTime?: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  const { data: business } = await supabase
    .from("businesses")
    .select("name, slug, language, wa_waitlist")
    .eq("id", businessId)
    .single() as { data: { name: string; slug: string; language: string | null; wa_waitlist: boolean | null } | null }

  // Match ALL active waitlist entries for this business + date (any service),
  // because a cancelled slot frees staff time that any service can use.
  const { data: entries, error } = await supabase
    .from("waitlist_entries")
    .select("id, customer_name, preferred_eras, customer_phone")
    .eq("business_id", businessId)
    .eq("preferred_date", appointmentDate)
    .eq("status", "active")

  if (error) {
    console.error("Waitlist lookup error:", error.message)
    return
  }

  if (!entries || entries.length === 0) return

  // Filter by era: only notify entries whose preferred time-of-day matches the freed slot
  const era = startTime ? getEraForTime(startTime) : null
  const matched = (entries as { id: string; customer_name: string; preferred_eras: string[] | null; customer_phone: string | null }[]).filter(e => {
    const eras = e.preferred_eras ?? []
    return eras.length === 0 || !era || eras.includes(era)
  })
  if (matched.length === 0) return

  const ids: string[] = matched.map(e => e.id)

  await supabase
    .from("waitlist_entries")
    .update({ status: "notified", updated_at: new Date().toISOString() })
    .in("id", ids)

  const count = matched.length
  const svcPart = serviceName ? ` for ${serviceName}` : ""

  try {
    await sendWaitlistCustomerPush(ids, {
      title: "A spot just opened!",
      body: `A slot${svcPart} opened up on ${appointmentDate}. Book now before it's gone.`,
      url: "/book",
    })
  } catch {
    // non-critical
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const lang = business?.language ?? "ar"
  const businessName = business?.name ?? ""
  const businessSlug = business?.slug ?? ""
  const [yr, mo, dy] = appointmentDate.split("-").map(Number)
  const dateObj = new Date(yr, mo - 1, dy)
  const dayName = (DAY_NAMES[lang] ?? DAY_NAMES.ar)[dateObj.getDay()]
  const timeDisplay = startTime ? startTime.slice(0, 5) : ""

  if (business?.wa_waitlist !== false) {
    for (const entry of matched) {
      if (!entry.customer_phone) continue
      sendWaitlistSlotOpen(entry.customer_phone, {
        customerName: entry.customer_name,
        businessName,
        dayName,
        date: appointmentDate,
        time: timeDisplay,
        bookUrl: `${baseUrl}/book/${businessSlug}`,
      }).then(() => logWaMessage(businessId, "waitlist", entry.customer_phone!))
        .catch((err) => { logWaMessage(businessId, "waitlist", entry.customer_phone!, "failed"); console.error("[waitlist] WhatsApp send failed:", err) })
    }
  }

  // Booklyt app notification (in-app + native push) for waitlisted customers
  // who have a customer account matching the waitlist phone number.
  try {
    const phones = matched
      .map((e) => e.customer_phone?.replace(/[\s\-().]/g, ""))
      .filter((p): p is string => Boolean(p))
    if (phones.length) {
      const { data: users } = await supabase
        .from("customer_users")
        .select("id, phone")
        .in("phone", phones) as { data: { id: string; phone: string }[] | null }
      const { notifyCustomer } = await import("@/lib/notifications/customer")
      for (const user of users ?? []) {
        await notifyCustomer(user.id, {
          type: "waitlist",
          title: lang === "ar" ? `فتح موعد — ${businessName}` : `A slot opened — ${businessName}`,
          body: lang === "ar"
            ? `${dayName} ${appointmentDate}${timeDisplay ? ` الساعة ${timeDisplay}` : ""} أصبح متاحاً. احجز الآن!`
            : `${dayName} ${appointmentDate}${timeDisplay ? ` at ${timeDisplay}` : ""} is now available. Book it before it's gone!`,
          businessId,
          url: `/app/${businessSlug}`,
        })
      }
    }
  } catch (err) {
    console.error("[waitlist] app notify failed:", err)
  }

  try {
    await sendBusinessPushNotification(businessId, {
      title: `Slot opened — ${count} waitlisted`,
      body: `A cancellation freed a slot${svcPart} on ${appointmentDate}. ${count} waitlisted customer${count > 1 ? "s have" : " has"} been notified. Check your waitlist.`,
      url: "/dashboard/appointments",
    })
  } catch {
    // non-critical
  }
}
