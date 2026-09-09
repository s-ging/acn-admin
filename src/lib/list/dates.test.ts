import { describe, expect, it } from 'vitest'
import {
  addMonths,
  countInRange,
  dayCounts,
  dayKeyOf,
  formatRange,
  inDayRange,
  monthGrid,
  monthOf,
  presetRange,
} from './dates'

describe('dayKeyOf', () => {
  it('keys a timestamp by its local calendar day', () => {
    // Built from local parts rather than parsed from a fixed ISO string, so the
    // expectation does not depend on the machine's zone.
    const iso = new Date(2026, 8, 10, 23, 30).toISOString()
    expect(dayKeyOf(iso)).toBe('2026-09-10')
  })

  it('has no answer for an unpublished release', () => {
    expect(dayKeyOf(null)).toBeNull()
    expect(dayKeyOf('')).toBeNull()
    expect(dayKeyOf('not a date')).toBeNull()
  })
})

describe('inDayRange', () => {
  const range = { from: '2026-09-01', to: '2026-09-30' }

  it('passes everything when there is no range', () => {
    expect(inDayRange('2020-01-01', null)).toBe(true)
    expect(inDayRange(null, null)).toBe(true)
  })

  it('includes both ends', () => {
    expect(inDayRange('2026-09-01', range)).toBe(true)
    expect(inDayRange('2026-09-30', range)).toBe(true)
    expect(inDayRange('2026-08-31', range)).toBe(false)
    expect(inDayRange('2026-10-01', range)).toBe(false)
  })

  it('excludes a release with no date once a range is chosen', () => {
    expect(inDayRange(null, range)).toBe(false)
  })
})

describe('dayCounts / countInRange', () => {
  const rows = [
    { at: '2026-09-10' },
    { at: '2026-09-10' },
    { at: '2026-09-09' },
    { at: null },
  ]

  it('counts rows per day, ignoring the undated', () => {
    const counts = dayCounts(rows, r => r.at)
    expect(counts.get('2026-09-10')).toBe(2)
    expect(counts.get('2026-09-09')).toBe(1)
    expect(counts.size).toBe(2)
  })

  it('totals a span', () => {
    const counts = dayCounts(rows, r => r.at)
    expect(countInRange(counts, { from: '2026-09-09', to: '2026-09-10' })).toBe(3)
    expect(countInRange(counts, { from: '2026-09-11', to: '2026-09-12' })).toBe(0)
  })
})

describe('month arithmetic', () => {
  it('rolls over the year boundary', () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
  })

  it('reads a month off a day key', () => {
    expect(monthOf('2026-09-10')).toEqual({ year: 2026, month: 8 })
  })
})

describe('monthGrid', () => {
  const weeks = monthGrid({ year: 2026, month: 8 })

  it('is always six weeks of seven days, starting on a Sunday', () => {
    expect(weeks).toHaveLength(6)
    for (const week of weeks) expect(week).toHaveLength(7)
    expect(new Date(`${weeks[0][0].key}T00:00:00`).getDay()).toBe(0)
  })

  it('covers the month and marks the borrowed days', () => {
    const own = weeks.flat().filter(d => d.inMonth)
    expect(own).toHaveLength(30)
    expect(own[0].key).toBe('2026-09-01')
    expect(own[29].key).toBe('2026-09-30')
    expect(weeks.flat().some(d => !d.inMonth)).toBe(true)
  })
})

describe('presetRange', () => {
  const today = new Date(2026, 8, 10)

  it('spans the period ending today', () => {
    expect(presetRange('today', today)).toEqual({ from: '2026-09-10', to: '2026-09-10' })
    expect(presetRange('week', today)).toEqual({ from: '2026-09-04', to: '2026-09-10' })
    expect(presetRange('month', today)).toEqual({ from: '2026-08-12', to: '2026-09-10' })
    expect(presetRange('year', today)).toEqual({ from: '2026-01-01', to: '2026-09-10' })
  })
})

describe('formatRange', () => {
  it('collapses a single day', () => {
    expect(formatRange({ from: '2026-09-10', to: '2026-09-10' })).toBe('2026/09/10')
    expect(formatRange({ from: '2026-09-01', to: '2026-09-10' })).toBe('2026/09/01 – 2026/09/10')
  })
})
