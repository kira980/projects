import { NextResponse } from 'next/server'
import { getCurrentCustomerUser } from '@/lib/customer-auth'

export async function GET() {
  const user = await getCurrentCustomerUser()
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
  return NextResponse.json({ user })
}
