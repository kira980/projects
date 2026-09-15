import { WorkingHours, Appointment, WorkingHourBreak } from "@/types/database"

export interface TimeSlot {
  time: string       // "09:00"
  label: string      // "9:00 AM"
  available: boolean
  capacity?: number
  booked_count?: number
  available_spots?: number
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const period = h < 12 ? "AM" : "PM"
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`
}

export function generateTimeSlots(
  workingHours: WorkingHours | null,
  existingAppointments: Pick<Appointment, "start_time" | "end_time" | "participants_count">[],
  durationMinutes: number,
  intervalMinutes = 15,
  capacity = 1,
  breaks: Pick<WorkingHourBreak, "start_time" | "end_time">[] = []
): TimeSlot[] {
  if (!workingHours || !workingHours.is_open || !workingHours.open_time || !workingHours.close_time) {
    return []
  }

  const openMin  = timeToMinutes(workingHours.open_time.slice(0, 5))
  const closeMin = timeToMinutes(workingHours.close_time.slice(0, 5))
  const slots: TimeSlot[] = []

  for (let start = openMin; start + durationMinutes <= closeMin; start += intervalMinutes) {
    const end = start + durationMinutes
    const startTime = minutesToTime(start)

    const bookedCount = existingAppointments.reduce((sum, appt) => {
      const apptStart = timeToMinutes(appt.start_time.slice(0, 5))
      const apptEnd   = timeToMinutes(appt.end_time.slice(0, 5))
      const overlaps = start < apptEnd && end > apptStart
      return overlaps ? sum + (appt.participants_count ?? 1) : sum
    }, 0)
    const availableSpots = Math.max(capacity - bookedCount, 0)
    const overlapsBreak = breaks.some((breakItem) => {
      const breakStart = timeToMinutes(breakItem.start_time.slice(0, 5))
      const breakEnd = timeToMinutes(breakItem.end_time.slice(0, 5))
      return start < breakEnd && end > breakStart
    })

    slots.push({
      time: startTime,
      label: minutesToLabel(start),
      available: availableSpots > 0 && !overlapsBreak,
      capacity,
      booked_count: bookedCount,
      available_spots: overlapsBreak ? 0 : availableSpots,
    })
  }

  return slots
}

export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const startMin = timeToMinutes(startTime)
  return minutesToTime(startMin + durationMinutes)
}
