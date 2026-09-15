/**
 * GET /api/customer/bookings
 * All bookings for the authenticated customer, across every business.
 * Requires the bf_user session; scoped by customer_user_id.
 */
import { NextResponse } from 'next/server'
import { getCurrentCustomerUser } from '@/lib/customer-auth'
import { getCustomerBookingsByUserId } from '@/lib/marketplace/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentCustomerUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const appointments = await getCustomerBookingsByUserId(user.id)
  return NextResponse.json({ appointments })
}
