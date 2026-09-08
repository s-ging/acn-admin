import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Topbar } from '../../components/ui/Topbar'
import { BackToTop } from '../../components/ui/BackToTop'
import { AlphabetIndex } from '../../components/ui/AlphabetIndex'
import { ColumnFilter } from '../../components/ui/ColumnFilter'
import { Pagination } from '../../components/ui/Pagination'
import { SyncStatus } from '../../components/ui/SyncStatus'
import { SectionNav } from '../../components/ui/SectionNav'
import { initialOf } from '../../lib/list/alphabet'
import { filterOptions, passesFilter } from '../../lib/list/filters'
import { useAllEvents, useRefreshRecords } from '../../hooks/useRecords'
import { EVENTS_WRITE } from '../../lib/events/write'
import { formatEventDates, eventStatus } from '../../lib/events/format'
import type { Event } from '../../types/event.types'

type SortField = 'startDate' | 'description' | 'id'
type SortDir = 'asc' | 'desc'

interface ColumnVisibility {
  status: boolean
  dates: boolean
  location: boolean
  organiser: boolean
  releases: boolean
}

/** Rows per page. The whole set is cached, so this is a display concern only. */
const PAGE_SIZE = 50

export default function EventsListPage() {
  const navigate = useNavigate()

  // All 839 events, cache-first. This same set backs the detail page, because
  // /api/Events/{id} answers 500 — see lib/api/repository.ts.
  const { data, isLoading, isFetching, error: queryError } = useAllEvents()
  const refresh = useRefreshRecords()
  // Rides along with the records — `publish` isn't on the Event contract, so it
  // can't be a field, but it comes off the same fetch. See loadAllEvents.
  const unpublished = data?.unpublishedIds
  const events: Event[] = useMemo(() => data?.records ?? [], [data])
  const apiError = data?.error ?? (queryError as Error | null)

  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('startDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [letter, setLetter] = useState<string | null>(null)
  const [statusSel, setStatusSel] = useState<string[]>([])
  const [yearSel, setYearSel] = useState<string[]>([])
  const [organiserSel, setOrganiserSel] = useState<string[]>([])
  const [columns, setColumns] = useState<ColumnVisibility>({
    status: true,
    dates: true,
    location: true,
    organiser: true,
    releases: true,
  })
  const [colDropdownOpen, setColDropdownOpen] = useState(false)
  const colDropdownRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colDropdownRef.current && !colDropdownRef.current.contains(e.target as Node)) {
        setColDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isUnpublished = (event: Event) => unpublished?.has(event.id) ?? false
  const statusOf = (event: Event) =>
    isUnpublished(event) ? 'unpublished' : eventStatus(event)

  const yearOf = (event: Event) => event.startDate.slice(0, 4) || null
  const organiserOf = (event: Event) => event.companies[0]?.name ?? null

  const statusOptions = useMemo(
    () => filterOptions(events, statusOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, unpublished]
  )
  const yearOptions = useMemo(
    // Years read better newest-first than by frequency.
    () => filterOptions(events, yearOf).sort((a, b) => b.value.localeCompare(a.value)),
    [events]
  )
  const organiserOptions = useMemo(() => filterOptions(events, organiserOf), [events])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    const rows = events.filter(e => {
      if (!passesFilter(statusSel, statusOf(e))) return false
      if (!passesFilter(yearSel, yearOf(e))) return false
      if (!passesFilter(organiserSel, organiserOf(e))) return false
      if (letter && initialOf(e.description) !== letter) return false
      if (q) {
        return (
          e.description.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          (organiserOf(e)?.toLowerCase().includes(q) ?? false) ||
          String(e.id).includes(q)
        )
      }
      return true
    })

    return rows.sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1
      if (sortField === 'description') return mult * a.description.localeCompare(b.description)
      if (sortField === 'id') return mult * (a.id - b.id)
      // The ISO strings all carry the same +08:00 offset, so comparing them as
      // strings is the same as comparing the instants — and avoids 839 Date
      // allocations per sort.
      return mult * (a.startDate > b.startDate ? 1 : a.startDate < b.startDate ? -1 : 0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, unpublished, search, statusSel, yearSel, organiserSel, letter, sortField, sortDir])

  const availableLetters = useMemo(
    () => new Set(events.map(e => initialOf(e.description))),
    [events]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [safePage])

  const resetFilters = () => {
    setSearch('')
    setLetter(null)
    setStatusSel([])
    setYearSel([])
    setOrganiserSel([])
    setPage(1)
  }

  const filtersActive =
    !!search || letter !== null || statusSel.length > 0 || yearSel.length > 0 ||
    organiserSel.length > 0

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(field)
      setSortDir(field === 'startDate' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  // Name A→Z, then Z→A, then by id — mirroring the companies column.
  const handleNameSort = () => {
    if (sortField === 'description' && sortDir === 'asc') setSortDir('desc')
    else if (sortField === 'description' && sortDir === 'desc') { setSortField('id'); setSortDir('asc') }
    else { setSortField('description'); setSortDir('asc') }
    setPage(1)
  }

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="companies-page">
      <Topbar
        breadcrumb={<SectionNav current="events" />}
        actions={
          // Creating an event needs a POST that does not exist. The button is
          // shown disabled rather than hidden, so the gap is visible and the
          // page doesn't silently look finished.
          <Button variant="primary" size="sm" disabled={!EVENTS_WRITE} title="The API has no write endpoint for events">
            + New event
          </Button>
        }
      />

      <div className="companies-toolbar">
        <input
          className="field__input"
          type="text"
          placeholder="Search all events..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ width: '180px' }}
        />

        {filtersActive && (
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        )}

        <div style={{ position: 'relative' }} ref={colDropdownRef}>
          <button className="toolbar-select-btn" onClick={() => setColDropdownOpen(o => !o)}>
            Columns <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {colDropdownOpen && (
            <div className="col-dropdown">
              {(
                [
                  ['status', 'Status'],
                  ['dates', 'Dates'],
                  ['location', 'Location'],
                  ['organiser', 'Organiser'],
                  ['releases', 'Releases'],
                ] as [keyof ColumnVisibility, string][]
              ).map(([key, label]) => (
                <label key={key} className="col-option">
                  <input
                    type="checkbox"
                    checked={columns[key]}
                    onChange={e => setColumns(c => ({ ...c, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>

        <SyncStatus
          origin={data?.origin}
          syncedAt={data?.syncedAt ?? null}
          busy={isFetching}
          onRefresh={() => refresh('events')}
        />
      </div>

      <AlphabetIndex
        available={availableLetters}
        value={letter}
        onChange={next => { setLetter(next); setPage(1) }}
      />

      {apiError && (
        <div className="companies-notice companies-notice--error">
          Could not reach the newswire API — showing {data?.origin === 'cache' ? 'the last synced copy' : 'nothing'}.
          <span className="hint"> {apiError.message}</span>
        </div>
      )}

      <div className="companies-table-wrap" ref={scrollRef}>
        {isLoading ? (
          <div className="companies-empty">
            <span>Loading all events from the newswire…</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="companies-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span>
              {events.length === 0 && apiError
                ? 'No events to show — the newswire could not be reached and nothing is cached yet.'
                : events.length === 0
                  ? 'No events yet.'
                  : 'No events match your search.'}
            </span>
            {events.length === 0 && apiError ? (
              <Button variant="outline" size="sm" onClick={() => refresh('events')}>Try again</Button>
            ) : filtersActive ? (
              <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>
            ) : null}
          </div>
        ) : (
          <table className="companies-table">
            <thead>
              <tr>
                <th
                  className={sortField === 'description' || sortField === 'id' ? 'sorted' : undefined}
                  onClick={handleNameSort}
                >
                  {sortField === 'id' ? 'Event ID' : 'Event'}
                  {sortField === 'description' || sortField === 'id'
                    ? (sortDir === 'asc' ? ' ↑' : ' ↓')
                    : ' ↕'}
                </th>
                {columns.status && (
                  <th>
                    <span className="th__inner">
                      Status
                      <ColumnFilter
                        label="Status"
                        options={statusOptions}
                        selected={statusSel}
                        onChange={next => { setStatusSel(next); setPage(1) }}
                      />
                    </span>
                  </th>
                )}
                {columns.dates && (
                  <th
                    className={sortField === 'startDate' ? 'sorted' : undefined}
                    onClick={() => handleSort('startDate')}
                  >
                    <span className="th__inner">
                      Dates{sortIcon('startDate')}
                      <ColumnFilter
                        label="Year"
                        options={yearOptions}
                        selected={yearSel}
                        onChange={next => { setYearSel(next); setPage(1) }}
                      />
                    </span>
                  </th>
                )}
                {columns.location && <th>Location</th>}
                {columns.organiser && (
                  <th>
                    <span className="th__inner">
                      Organiser
                      <ColumnFilter
                        label="Organiser"
                        options={organiserOptions}
                        selected={organiserSel}
                        onChange={next => { setOrganiserSel(next); setPage(1) }}
                      />
                    </span>
                  </th>
                )}
                {columns.releases && <th>Releases</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map(event => {
                const organiser = event.companies[0]
                const status = statusOf(event)

                return (
                  <tr key={event.id} onClick={() => navigate(`/events/${event.id}`)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* A raw <img>: these live on www.acnnewswire.com under
                            /eventimages/, and 16 of 839 events have none. */}
                        {event.photo ? (
                          <img
                            src={event.photo}
                            alt=""
                            className="company-avatar"
                            style={{ objectFit: 'contain' }}
                            loading="lazy"
                          />
                        ) : (
                          <div className="company-avatar avatar-color-3">
                            {initialOf(event.description)}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                            {event.description || 'Untitled event'}
                          </div>
                          <div className="hint monospace">#{event.id}</div>
                        </div>
                      </div>
                    </td>
                    {columns.status && (
                      <td>
                        <span className={`badge badge--${status}`}>{status}</span>
                      </td>
                    )}
                    {columns.dates && (
                      <td>
                        <div className="text-[var(--text-sm)]">{formatEventDates(event)}</div>
                      </td>
                    )}
                    {columns.location && (
                      <td>
                        {event.location ? (
                          <span className="sectors-cell" title={event.location}>{event.location}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                        )}
                      </td>
                    )}
                    {columns.organiser && (
                      <td>
                        {organiser ? (
                          <span className="sectors-cell" title={organiser.name}>{organiser.name}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                        )}
                      </td>
                    )}
                    {columns.releases && (
                      <td>
                        {/* Whether a feed is even possible, not how many there
                            are — the count needs a request per event. */}
                        {event.compId !== null ? (
                          <span className="label monospace">available</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>none</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <BackToTop targetRef={scrollRef} resetKey={safePage} />

      <div className="companies-footer">
        <span>
          {filtersActive ? (
            <>
              <strong>{filtered.length.toLocaleString()}</strong> of{' '}
              {events.length.toLocaleString()} events match
            </>
          ) : (
            <>
              <strong>{events.length.toLocaleString()}</strong>{' '}
              {events.length === 1 ? 'event' : 'events'}
            </>
          )}
          {visible.length > 0 && (
            <span className="hint">
              {' '}· showing {((safePage - 1) * PAGE_SIZE + 1).toLocaleString()}–
              {((safePage - 1) * PAGE_SIZE + visible.length).toLocaleString()}
            </span>
          )}
        </span>

        <Pagination page={safePage} onPage={setPage} totalPages={totalPages} busy={isLoading} />
      </div>
    </div>
  )
}
