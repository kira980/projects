/**
 * Minimal iCalendar (.ics) generation for "Add to calendar".
 * Pure functions — safe on client and server.
 */

export interface IcsEvent {
  title: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM or HH:MM:SS */
  startTime: string
  /** HH:MM or HH:MM:SS */
  endTime: string
  description?: string
  location?: string
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** "2026-07-11" + "14:30" → "20260711T143000" (floating local time). */
function icsLocalStamp(date: string, time: string): string {
  const [h = '00', m = '00', s = '00'] = time.split(':')
  return `${date.replace(/-/g, '')}T${h.padStart(2, '0')}${m.padStart(2, '0')}${(s || '00').padStart(2, '0')}`
}

export function buildIcs(event: IcsEvent): string {
  const uid = `${icsLocalStamp(event.date, event.startTime)}-${Math.random().toString(36).slice(2)}@booklyt`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Booklyt//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsLocalStamp(event.date, event.startTime)}`,
    `DTSTART:${icsLocalStamp(event.date, event.startTime)}`,
    `DTEND:${icsLocalStamp(event.date, event.endTime)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${icsEscape(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${icsEscape(event.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

/** Data URL suitable for a download link (<a href download>). */
export function icsDataUrl(event: IcsEvent): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(event))}`
}
