/**
 * WhatsApp Cloud API webhook.
 *
 * GET  /api/webhooks/whatsapp  — Meta webhook verification handshake
 * POST /api/webhooks/whatsapp  — Incoming message notifications
 *
 * Required env var:
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN  — token you set in Meta App Dashboard
 */
import { NextRequest, NextResponse } from "next/server"

/** GET: Meta calls this once to verify the webhook URL. */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const mode      = searchParams.get("hub.mode")
  const token     = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) {
    console.error("[wa-webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN not set")
    return new NextResponse("Server misconfigured", { status: 500 })
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[wa-webhook] Webhook verified")
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse("Forbidden", { status: 403 })
}

/** POST: Meta sends message events here. */
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new NextResponse("Bad Request", { status: 400 })
  }

  // Verify X-Hub-Signature-256 in production to ensure the request is from Meta.
  // For now we acknowledge immediately (200) so Meta doesn't retry.
  console.log("[wa-webhook] event received:", JSON.stringify(body))

  // Handle status updates and inbound messages
  const data = body as {
    object?: string
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{ from: string; text?: { body: string }; type: string }>
          statuses?: Array<{ status: string; recipient_id: string }>
        }
      }>
    }>
  }

  if (data?.object === "whatsapp_business_account") {
    for (const entry of data.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value
        // Log inbound messages (OTP replies, etc.)
        for (const msg of value?.messages ?? []) {
          console.log(`[wa-webhook] msg from ${msg.from}: ${msg.text?.body ?? "(non-text)"}`)
        }
        // Log delivery/read statuses
        for (const status of value?.statuses ?? []) {
          console.log(`[wa-webhook] status ${status.status} for ${status.recipient_id}`)
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
