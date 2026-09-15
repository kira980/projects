import { NextRequest, NextResponse } from 'next/server'
import { getCustomerBookings } from '@/lib/marketplace/queries'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const phone = searchParams.get('phone') ?? undefined
  const email = searchParams.get('email') ?? undefined

  const appointments = await getCustomerBookings(phone, email)
  return NextResponse.json({ appointments })
}
