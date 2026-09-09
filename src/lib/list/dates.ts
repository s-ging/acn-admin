// src/lib/list/dates.ts
// Which calendar day a record belongs to, and the arithmetic a month grid needs.
//
// Split out from <CalendarFilter> for the same reason as lib/list/alphabet.ts:
// the list page needs these to count the days behind the grid and to filter
// rows, and a component file that also exports functions breaks fast refresh.
//
// Days are keyed 'YYYY-MM-DD' in LOCAL time, not UTC. The list already prints
// `published_at` through the browser's own calendar, so a release shown as
// 2026/09/10 must land in the 10th's bucket — keying off the ISO string's UTC
// date would put the evening releases a day early for anyone east of Greenwich,
// which on a Tokyo-run wire is everyone.

/** An inclusive span of days, both ends keyed 'YYYY-MM-DD'. */
export interface DayRange {
  from: string
  to: string
}

/** The local-time day key for a date, e.g. '2026-09-10'. */
export function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * The day a timestamp falls on, or null when there isn't one.
 *
 * Null is its own answer rather than a bucket: an unpublished release has no
 * place on a calendar, and dropping it into "today" would be a lie.
 */
export function dayKeyOf(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : dayKey(d)
}

/** Whether a day key falls inside a range. A null key is inside no range. */
export function inDayRange(key: string | null, range: DayRange | null): boolean {
  if (!range) return true
  if (!key) return false
  return key >= range.from && key <= range.to
}

/** How many rows fall on each day — the numbers behind the grid. */
export function dayCounts<T>(rows: T[], get: (row: T) => string | null): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = get(row)
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** How many rows a range would leave — used to disable empty presets. */
export function countInRange(counts: Map<string, number>, range: DayRange): number {
  let total = 0
  for (const [key, n] of counts) {
    if (key >= range.from && key <= range.to) total += n
  }
  return total
}

// ── Month arithmetic ────────────────────────────────────────────────────────

/** A month, as a year and a 0-based month index — the shape `Date` speaks. */
export interface Month {
  year: number
  month: number
}

export function monthOf(key: string): Month {
  const [y, m] = key.split('-')
  return { year: Number(y), month: Number(m) - 1 }
}

export function addMonths({ year, month }: Month, delta: number): Month {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export function monthLabel({ year, month }: Month): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export interface GridDay {
  key: string
  /** Day of the month, 1–31. */
  day: number
  /** False for the leading/trailing days borrowed from the neighbouring months. */
  inMonth: boolean
}

/**
 * Six weeks of seven days covering a month, Sunday first.
 *
 * Always six rows, even when five would cover the month: a grid that changes
 * height as you page through it makes the arrows move out from under the
 * pointer. The borrowed days are still clickable — a release on the 1st and one
 * on the 31st of the month before are one row apart on this grid, and refusing
 * the click would be pedantry.
 */
export function monthGrid({ year, month }: Month): GridDay[][] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())

  const weeks: GridDay[][] = []
  for (let w = 0; w < 6; w++) {
    const week: GridDay[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
      week.push({ key: dayKey(date), day: date.getDate(), inMonth: date.getMonth() === month })
    }
    weeks.push(week)
  }
  return weeks
}

/** Sunday-first weekday initials, in the browser's own locale. */
export const WEEKDAY_INITIALS = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 8, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' })
)

// ── Presets and labels ──────────────────────────────────────────────────────

export type PresetId = 'today' | 'week' | 'month' | 'year'

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'Last 30 days' },
  { id: 'year', label: 'This year' },
]

/** The span a preset stands for, relative to a given day (defaults to now). */
export function presetRange(id: PresetId, today = new Date()): DayRange {
  const to = dayKey(today)
  if (id === 'today') return { from: to, to }
  if (id === 'year') return { from: dayKey(new Date(today.getFullYear(), 0, 1)), to }
  const back = id === 'week' ? 6 : 29
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back)
  return { from: dayKey(from), to }
}

/** '2026-09-10' → '2026/09/10', matching the Published column. */
export function formatDayKey(key: string): string {
  return key.replace(/-/g, '/')
}

/** How a chosen range reads in the bar: one day, or a span. */
export function formatRange(range: DayRange): string {
  return range.from === range.to
    ? formatDayKey(range.from)
    : `${formatDayKey(range.from)} – ${formatDayKey(range.to)}`
}
