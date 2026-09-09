// src/components/ui/CalendarFilter.tsx
// The publication calendar: filter the list down to a day or a span of days.
//
// This sits where the A–Z index used to. An alphabet is the wrong index for a
// wire — nobody looks for a release by the first letter of its headline, and on
// a list sorted newest-first the letters scatter across every page. The question
// actually asked of a press release archive is "what went out on the 9th", so
// the index is a calendar.
//
// A filter rather than a scroll-to, for the same reason the A–Z was: narrowing
// the set composes with the other controls, where a jump would have to work out
// which page a date falls on and the answer changes with every sort.
//
// Days with nothing behind them are dimmed rather than hidden, so the grid keeps
// the shape of a month. Same for the presets: "Today" stays in place and goes
// flat when the page in hand holds nothing from today.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PRESETS,
  WEEKDAY_INITIALS,
  addMonths,
  countInRange,
  dayKey,
  formatRange,
  monthGrid,
  monthLabel,
  monthOf,
  presetRange,
  type DayRange,
  type Month,
  type PresetId,
} from '../../lib/list/dates'

interface CalendarFilterProps {
  /** Rows per day key, from `dayCounts` — the numbers under the grid. */
  counts: Map<string, number>
  /** The chosen span, or null for all dates. */
  value: DayRange | null
  onChange: (range: DayRange | null) => void
}

/** Whether a range is exactly what a preset stands for, so it can light up. */
function matchingPreset(value: DayRange | null): PresetId | null {
  if (!value) return null
  for (const preset of PRESETS) {
    const range = presetRange(preset.id)
    if (value.from === range.from && value.to === range.to) return preset.id
  }
  return null
}

export function CalendarFilter({ counts, value, onChange }: CalendarFilterProps) {
  const [open, setOpen] = useState(false)
  // Half a range: the first click of a two-click span, before the second lands.
  const [anchor, setAnchor] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const today = dayKey(new Date())

  // Which month the grid opens on: the one holding the current selection, else
  // the newest day the page actually carries. Opening on the real today would
  // show an empty grid to anyone reading page 400 of the archive.
  const latest = useMemo(() => {
    let max: string | null = null
    for (const key of counts.keys()) if (!max || key > max) max = key
    return max
  }, [counts])

  // Null means "follow the data": the grid sits on the month of the current
  // selection, or failing that on the newest day the page carries. Paging the
  // arrows pins a month until the popover is closed again, which is why this is
  // a nullable override rather than a plain month kept in sync by an effect.
  const [month, setMonth] = useState<Month | null>(null)
  const shown = month ?? monthOf(value?.to ?? latest ?? today)

  // Closing resets the view as well as the selection, so reopening never
  // resumes a half-finished span or lands on a month nothing led you to.
  const close = () => {
    setOpen(false)
    setAnchor(null)
    setHover(null)
    setMonth(null)
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const weeks = useMemo(() => monthGrid(shown), [shown])

  // What the grid paints as selected: the committed range, or the span between
  // the first click and whatever the pointer is over.
  const edge = hover ?? anchor
  const preview: DayRange | null =
    anchor && edge
      ? { from: anchor < edge ? anchor : edge, to: anchor < edge ? edge : anchor }
      : value

  const pick = (key: string) => {
    if (!anchor) {
      setAnchor(key)
      return
    }
    onChange(anchor <= key ? { from: anchor, to: key } : { from: key, to: anchor })
    close()
  }

  const activePreset = matchingPreset(value)

  return (
    <div className="date-index" role="group" aria-label="Filter by publication date">
      <button
        type="button"
        className={`date-index__item${value === null ? ' date-index__item--on' : ''}`}
        onClick={() => onChange(null)}
      >
        All dates
      </button>

      {PRESETS.map(preset => {
        const range = presetRange(preset.id)
        const n = countInRange(counts, range)
        const on = activePreset === preset.id
        return (
          <button
            key={preset.id}
            type="button"
            className={`date-index__item${on ? ' date-index__item--on' : ''}`}
            disabled={n === 0 && !on}
            title={n === 0 ? 'Nothing from this period on this page' : `${n} on this page`}
            // Clicking the active preset again clears it, so the row doubles as
            // its own reset without a trip to "All dates".
            onClick={() => onChange(on ? null : range)}
          >
            {preset.label}
          </button>
        )
      })}

      <div className="date-index__picker" ref={ref}>
        <button
          type="button"
          className={`date-index__item date-index__trigger${
            value && !activePreset ? ' date-index__item--on' : ''
          }`}
          aria-expanded={open}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M1.5 5.5h11M4.5 1v2.5M9.5 1v2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          {value && !activePreset ? formatRange(value) : 'Pick dates'}
        </button>

        {open && (
          <div className="calendar">
            <div className="calendar__head">
              <button
                type="button"
                className="calendar__nav"
                aria-label="Previous month"
                onClick={() => setMonth(addMonths(shown, -1))}
              >
                ‹
              </button>
              <span className="calendar__month">{monthLabel(shown)}</span>
              <button
                type="button"
                className="calendar__nav"
                aria-label="Next month"
                onClick={() => setMonth(addMonths(shown, 1))}
              >
                ›
              </button>
            </div>

            <div className="calendar__grid" onMouseLeave={() => setHover(null)}>
              {WEEKDAY_INITIALS.map((initial, i) => (
                <span key={i} className="calendar__weekday">
                  {initial}
                </span>
              ))}

              {weeks.flat().map(cell => {
                const n = counts.get(cell.key) ?? 0
                const inRange = !!preview && cell.key >= preview.from && cell.key <= preview.to
                const className = [
                  'calendar__day',
                  cell.inMonth ? '' : 'calendar__day--outside',
                  inRange ? 'calendar__day--on' : '',
                  n > 0 ? 'calendar__day--has' : '',
                  cell.key === today ? 'calendar__day--today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={className}
                    title={n > 0 ? `${n} on this page` : undefined}
                    onClick={() => pick(cell.key)}
                    onMouseEnter={() => setHover(cell.key)}
                  >
                    {cell.day}
                  </button>
                )
              })}
            </div>

            <div className="calendar__foot">
              <span className="hint">
                {anchor ? 'Pick the end of the range' : 'Click a day, then a second for a range'}
              </span>
              <button
                type="button"
                className="calendar__clear"
                disabled={!value && !anchor}
                onClick={() => {
                  setAnchor(null)
                  onChange(null)
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
