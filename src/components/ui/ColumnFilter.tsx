// src/components/ui/ColumnFilter.tsx
// The funnel in a column header: pick which values of that column to show.
//
// Multi-select rather than single, because the useful questions are plural —
// "Technology *and* Industrial", "everything except Archived". An empty
// selection means no filter at all, which is why the reset control says "All"
// rather than clearing to nothing visible.
//
// The counts next to each value are the point of the control as much as the
// checkboxes are: on a 9,439-row list they are the only way to see that a
// sector has three companies in it before filtering down to them.

import { useEffect, useRef, useState } from 'react'
import type { FilterOption } from '../../lib/list/filters'

interface ColumnFilterProps {
  /** The column's name, for the tooltip and the dropdown heading. */
  label: string
  options: FilterOption[]
  /** Empty means unfiltered. */
  selected: string[]
  onChange: (selected: string[]) => void
}

export function ColumnFilter({ label, options, selected, onChange }: ColumnFilterProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const active = selected.length > 0

  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]
    )
  }

  // A long value list (sectors, exchanges) needs its own search; a short one
  // (status) would only be cluttered by it.
  const searchable = options.length > 12
  const visible = search
    ? options.filter(o => o.value.toLowerCase().includes(search.toLowerCase()))
    : options

  return (
    <div className="col-filter" ref={ref}>
      <button
        type="button"
        className={`col-filter__btn${active ? ' col-filter__btn--active' : ''}`}
        title={active ? `${label}: ${selected.join(', ')}` : `Filter by ${label}`}
        aria-label={`Filter by ${label}`}
        aria-expanded={open}
        // The header cell itself sorts, so the funnel must not also sort.
        onClick={event => {
          event.stopPropagation()
          setOpen(o => !o)
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M1.5 2.5h9l-3.5 4v3l-2 1v-4l-3.5-4z"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
            fill={active ? 'currentColor' : 'none'}
          />
        </svg>
        {active && <span className="col-filter__count">{selected.length}</span>}
      </button>

      {open && (
        <div className="col-filter__menu" onClick={event => event.stopPropagation()}>
          <div className="col-filter__head">
            <span>{label}</span>
            <button
              type="button"
              className="col-filter__reset"
              disabled={!active}
              onClick={() => onChange([])}
            >
              All
            </button>
          </div>

          {searchable && (
            <input
              className="col-filter__search"
              type="text"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={search}
              onChange={event => setSearch(event.target.value)}
              autoFocus
            />
          )}

          <div className="col-filter__list">
            {visible.length === 0 ? (
              <div className="col-filter__empty">No matches</div>
            ) : (
              visible.map(option => (
                <label key={option.value} className="col-filter__option">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => toggle(option.value)}
                  />
                  <span className="col-filter__value">{option.value}</span>
                  <span className="col-filter__n">{option.count.toLocaleString()}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
