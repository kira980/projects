import { NextResponse } from "next/server";
import { resetDatabase } from "@/lib/demo-backend/store";

/**
 * Puts the demo back to its starting state without restarting the server.
 *
 * Handy after a reviewer has been clicking around: everything created,
 * cancelled or paid is discarded and the dataset is regenerated.
 */
export async function POST() {
  const result = resetDatabase();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  return NextResponse.json(
    { message: "POST to this endpoint to regenerate the demo data." },
    { status: 405 }
  );
}
