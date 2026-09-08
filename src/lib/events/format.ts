// src/lib/events/format.ts
// Rendering an event's dates and its status.
//
// Both of these have to respect the +08:00 the mapper stamps on, which means
// neither can go through a plain `new Date().toLocaleDateString()` — that would
// re-read the instant in the *viewer's* zone and hand back the previous day for
// anyone west of the wire, undoing the very thing the offset is there to fix.
//
// So the ISO string is read as text. It already says which calendar day is
// meant; there is nothing to convert.

import type { Event } from '../../types/event.types'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

interface EventDate {
  year: number
  month: number
  day: number
}

/** The calendar date out of an offset-bearing ISO string, as written. */
export function readEventDate(iso: string | null | undefined): EventDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!match) return null
  return { year: +match[1], month: +match[2], day: +match[3] }
}

function formatOne({ year, month, day }: EventDate): string {
  return `${day} ${MONTHS[month - 1] ?? '?'} ${year}`
}

/**
 * An event's date range, collapsed where the parts repeat.
 *
 *   same day          16 Jul 2009
 *   same month        16–17 Jul 2009
 *   same year         28 Nov – 13 Dec 2007
 *   spanning years    28 Dec 2007 – 3 Jan 2008
 *
 * Worth the branching: 839 events over 20 years, and a naive
 * "start – end" renders the great majority as "16 Jul 2009 – 16 Jul 2009".
 */
export function formatEventDates(event: Event): string {
  const start = readEventDate(event.startDate)
  const end = readEventDate(event.endDate)

  if (!start) return '—'
  if (!end) return formatOne(start)

  if (start.year === end.year && start.month === end.month && start.day === end.day) {
    return formatOne(start)
  }
  if (start.year === end.year && start.month === end.month) {
    return `${start.day}–${end.day} ${MONTHS[start.month - 1]} ${start.year}`
  }
  if (start.year === end.year) {
    return `${start.day} ${MONTHS[start.month - 1]} – ${end.day} ${MONTHS[end.month - 1]} ${start.year}`
  }
  return `${formatOne(start)} – ${formatOne(end)}`
}

export type EventStatus = 'past' | 'running' | 'upcoming'

/**
 * Where the event sits relative to now.
 *
 * Compared as instants, because this is the one question that genuinely is about
 * a moment rather than a calendar day — and the offsets make it safe: the mapper
 * put `endDate` at 23:59:59+08:00, so an event on its final day still reads as
 * running right up to midnight on the wire.
 *
 * An event with no usable dates reads as 'past', which keeps it out of the way
 * of anyone looking at what is coming up.
 */
export function eventStatus(event: Event, now = Date.now()): EventStatus {
  const start = Date.parse(event.startDate)
  const end = Date.parse(event.endDate)

  if (Number.isNaN(start) || Number.isNaN(end)) return 'past'
  if (now < start) return 'upcoming'
  if (now > end) return 'past'
  return 'running'
}

/** The year to ask the API for this event's releases. */
export function eventYearOf(event: Event): number | null {
  return readEventDate(event.startDate)?.year ?? null
}

/** `EventRelease.dateTime` for display. No offset on these — see the type. */
export function formatReleaseDate(iso: string | null | undefined): string {
  const date = readEventDate(iso)
  if (!date) return '—'
  const time = /T(\d{2}):(\d{2})/.exec(iso ?? '')
  const clock = time ? ` ${time[1]}:${time[2]}` : ''
  return `${formatOne(date)}${clock}`
}
