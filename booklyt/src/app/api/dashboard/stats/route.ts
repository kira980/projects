import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Returns aggregate stats for the authenticated business owner's dashboard.
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: business } = await db
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single() as { data: { id: string } | null }

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const businessId = business.id
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 6)
  const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 29)
  const thirtyDaysAgo = monthAgo.toISOString().slice(0, 10)
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)

  const { data: allAppts } = await db
    .from('appointments')
    .select('id, status, appointment_date, services(price), participants_count')
    .eq('business_id', businessId) as {
      data: Array<{
        id: string
        status: string
        appointment_date: string
        services: { price: number } | null
        participants_count: number
      }> | null
    }

  const appts = allAppts ?? []

  const total = appts.length
  const todayCount = appts.filter((a) => a.appointment_date === todayStr).length
  const weekCount = appts.filter((a) => a.appointment_date >= weekAgoStr && a.appointment_date <= todayStr).length
  const monthCount = appts.filter((a) => a.appointment_date >= thirtyDaysAgo && a.appointment_date <= todayStr).length
  const cancelledCount = appts.filter((a) => a.status === 'cancelled').length
  const completedCount = appts.filter((a) => a.status === 'completed').length

  const totalRevenue = appts
    .filter((a) => a.status === 'completed')
    .reduce((sum, a) => sum + (a.services?.price ?? 0) * (a.participants_count ?? 1), 0)

  // Most booked service in last 30 days
  const { data: serviceStats } = await db
    .from('appointments')
    .select('service_id, services(name)')
    .eq('business_id', businessId)
    .gte('appointment_date', thirtyDaysAgo)
    .neq('status', 'cancelled') as {
      data: Array<{ service_id: string; services: { name: string } | null }> | null
    }

  const serviceCounts: Record<string, { name: string; count: number }> = {}
  for (const a of serviceStats ?? []) {
    const sId = a.service_id
    if (!serviceCounts[sId]) serviceCounts[sId] = { name: a.services?.name ?? sId, count: 0 }
    serviceCounts[sId].count++
  }
  const mostBookedService = Object.values(serviceCounts).sort((a, b) => b.count - a.count)[0] ?? null

  // Daily appointment counts for last 30 days
  const dailyMap: Record<string, number> = {}
  for (const a of appts) {
    if (a.appointment_date >= thirtyDaysAgo && a.appointment_date <= todayStr) {
      dailyMap[a.appointment_date] = (dailyMap[a.appointment_date] ?? 0) + 1
    }
  }
  const dailyChart = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(monthAgo)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    return { date: dateStr, count: dailyMap[dateStr] ?? 0 }
  })

  return NextResponse.json({
    total,
    today: todayCount,
    week: weekCount,
    month: monthCount,
    cancelled: cancelledCount,
    completed: completedCount,
    total_revenue: totalRevenue,
    most_booked_service: mostBookedService,
    daily_chart: dailyChart,
  })
}
