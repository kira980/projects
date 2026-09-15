/**
 * WhatsApp messaging — supports both Twilio and Meta Cloud API.
 *
 * Switch providers with WHATSAPP_PROVIDER: "meta" | "twilio".
 * Unset defaults to "twilio" for backwards compatibility.
 *
 * Currently "meta": the Twilio account was suspended (error 20003, "account
 * ... is not active"), which made every send throw a 401. Both transports are
 * kept live so flipping the env var is enough to go back once Twilio is
 * reinstated — no code change and no template changes required.
 *
 * ── Twilio env vars ──
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 *
 * ── Meta env vars (for after Meta Business Verification) ──
 *   META_WHATSAPP_PHONE_NUMBER_ID, META_WHATSAPP_TOKEN, META_WHATSAPP_API_VERSION
 *   WHATSAPP_PROVIDER=meta
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Template IDs / Names
// ═══════════════════════════════════════════════════════════════════════════════

// Twilio Content SIDs
const TWILIO_OTP              = "HX634b5b12c249231365573900f03c82c5"
const TWILIO_BOOKING_CONFIRM  = "HX90f421bee152cc2e5ce5b07948bb3faf"
const TWILIO_REMINDER         = "HX0def86c34702bf6100ccce0b960ec2b8"
const TWILIO_VERIFY_LINK      = "HX8e14502537c9a730149d950fe52afca5"
const TWILIO_WAITLIST_OPEN    = "HXa1bc4c959b807f078f46eec0f13feb90"

// Meta template names — all five verified APPROVED on WABA 1147800667551164,
// with language codes and body-variable counts matching the calls below.
const META_OTP                = "cou_hx634b5b12c249231365573900f03c82c5"
const META_BOOKING_CONFIRM    = "bookin_confirmation_hx90f421bee152cc2e5ce5b07948bb3faf"
const META_REMINDER           = "remainder_hx0def86c34702bf6100ccce0b960ec2b8"
const META_VERIFY_LINK        = "finish_booking_hx8e14502537c9a730149d950fe52afca5"
const META_WAITLIST_OPEN      = "waitlist_message_hxa1bc4c959b807f078f46eec0f13feb90"

// ═══════════════════════════════════════════════════════════════════════════════
// Provider detection
// ═══════════════════════════════════════════════════════════════════════════════

export type WhatsAppProvider = "meta" | "twilio"

export function whatsappProvider(): WhatsAppProvider {
  return process.env.WHATSAPP_PROVIDER === "meta" ? "meta" : "twilio"
}

function isMetaProvider(): boolean {
  return whatsappProvider() === "meta"
}

// ═══════════════════════════════════════════════════════════════════════════════
// Twilio transport
// ═══════════════════════════════════════════════════════════════════════════════

const TWILIO_BASE = "https://api.twilio.com/2010-04-01"

function twilioAuth() {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) throw new Error("Twilio credentials not configured")
  return { sid, token }
}

async function twilioPost(path: string, form: Record<string, string>) {
  const { sid, token } = twilioAuth()
  const res = await fetch(`${TWILIO_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
    },
    body: new URLSearchParams(form).toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Twilio ${res.status}: ${text}`)
  }
  return res.json()
}

function twilioFrom() {
  const num = process.env.TWILIO_WHATSAPP_FROM
  if (!num) throw new Error("TWILIO_WHATSAPP_FROM not configured")
  return `whatsapp:${num.startsWith("+") ? num : "+" + num}`
}

function twilioTo(phone: string) {
  const normalized = phone.startsWith("+") ? phone : "+" + phone
  return `whatsapp:${normalized}`
}

function twilioMsgPath() {
  return `/Accounts/${twilioAuth().sid}/Messages.json`
}

function twilioSend(to: string, contentSid: string, vars: Record<string, string>) {
  return twilioPost(twilioMsgPath(), {
    From: twilioFrom(),
    To: twilioTo(to),
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(vars),
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Meta Cloud API transport
// ═══════════════════════════════════════════════════════════════════════════════

function metaConfig() {
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID
  const token   = process.env.META_WHATSAPP_TOKEN
  const version = process.env.META_WHATSAPP_API_VERSION ?? "v21.0"
  if (!phoneId || !token) throw new Error("Meta WhatsApp credentials not configured")
  return { phoneId, token, version }
}

function metaNormalizePhone(phone: string): string {
  return phone.replace(/[\s\-().+]/g, "")
}

async function metaSend(to: string, templateName: string, params: string[], lang = "ar") {
  const { phoneId, token, version } = metaConfig()
  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`

  const body = {
    messaging_product: "whatsapp",
    to: metaNormalizePhone(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: lang },
      components: [
        {
          type: "body",
          parameters: params.map(text => ({ type: "text", text })),
        },
      ],
    },
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    // Surface Meta's own error code: 132001 means the template name or language
    // does not exist, 132000 a parameter-count mismatch, 131047 a closed session.
    // Without it every failure reads as an opaque HTTP status in the logs.
    let detail = text
    try {
      const e = JSON.parse(text)?.error
      if (e) detail = `${e.code}/${e.error_subcode ?? "-"} ${e.message}${e.error_data?.details ? ` — ${e.error_data.details}` : ""}`
    } catch {}
    console.error(`[whatsapp] Meta API error ${res.status} sending "${templateName}" (${lang}):`, detail)
    throw new Error(`Meta WhatsApp ${res.status}: ${detail}`)
  }

  return res.json()
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public API — each function picks the right transport automatically
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendOtp(to: string, code: string) {
  if (isMetaProvider()) return metaSend(to, META_OTP, [code], "en")
  return twilioSend(to, TWILIO_OTP, { "1": code })
}

export async function sendBookingConfirmation(to: string, opts: {
  customerName: string
  businessName: string
  manageUrl: string
}) {
  if (isMetaProvider()) return metaSend(to, META_BOOKING_CONFIRM, [opts.customerName, opts.businessName, opts.manageUrl])
  return twilioSend(to, TWILIO_BOOKING_CONFIRM, { "1": opts.customerName, "2": opts.businessName, "3": opts.manageUrl })
}

export async function sendAppointmentReminder(to: string, opts: {
  customerName: string
  businessName: string
  manageUrl: string
}) {
  if (isMetaProvider()) return metaSend(to, META_REMINDER, [opts.customerName, opts.businessName, opts.manageUrl])
  return twilioSend(to, TWILIO_REMINDER, { "1": opts.customerName, "2": opts.businessName, "3": opts.manageUrl })
}

export async function sendBookingVerificationLink(to: string, opts: {
  customerName: string
  businessName: string
  dayName: string
  date: string
  time: string
  confirmUrl: string
}) {
  const params = [opts.customerName, opts.businessName, opts.dayName, opts.date, opts.time, opts.confirmUrl]
  if (isMetaProvider()) return metaSend(to, META_VERIFY_LINK, params)
  return twilioSend(to, TWILIO_VERIFY_LINK, { "1": params[0], "2": params[1], "3": params[2], "4": params[3], "5": params[4], "6": params[5] })
}

export async function sendWaitlistSlotOpen(to: string, opts: {
  customerName: string
  businessName: string
  dayName: string
  date: string
  time: string
  bookUrl: string
}) {
  const params = [opts.customerName, opts.businessName, opts.dayName, opts.date, opts.time, opts.bookUrl]
  if (isMetaProvider()) return metaSend(to, META_WAITLIST_OPEN, params)
  return twilioSend(to, TWILIO_WAITLIST_OPEN, { "1": params[0], "2": params[1], "3": params[2], "4": params[3], "5": params[4], "6": params[5] })
}
