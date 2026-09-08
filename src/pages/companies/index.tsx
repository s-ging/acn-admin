import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../../store/company.store'
import { Button } from '../../components/ui/Button'
import { Topbar } from '../../components/ui/Topbar'
import { BackToTop } from '../../components/ui/BackToTop'
import { AlphabetIndex } from '../../components/ui/AlphabetIndex'
import { ColumnFilter } from '../../components/ui/ColumnFilter'
import { initialOf } from '../../lib/list/alphabet'
import { filterOptions, passesFilter } from '../../lib/list/filters'
import { Pagination } from '../../components/ui/Pagination'
import { SyncStatus } from '../../components/ui/SyncStatus'
import { SectionNav } from '../../components/ui/SectionNav'
import { saveCompany } from '../../lib/companies/storage'
import { useAllCompanies, useRefreshRecords } from '../../hooks/useRecords'
import { blankCompany } from '../../lib/companies/blank'
import type { CompanyFull } from '../../types/company.types'

type SortField = 'name_en' | 'updated_at' | 'id'
type SortDir = 'asc' | 'desc'

interface ColumnVisibility {
  status: boolean
  primaryListing: boolean
  sectors: boolean
  lastModified: boolean
}

/**
 * Rows per page.
 *
 * The whole set is already in memory — this is a display concern, not a fetch
 * one, so paging costs nothing and the number can be chosen for readability
 * rather than for bandwidth.
 */
const PAGE_SIZE = 100

function generateCompanyId(): number {
  const existingIds = Object.keys(localStorage)
    .filter(k => k.startsWith('acn_company_'))
    .map(k => {
      const parsed = parseInt(k.replace('acn_company_', ''), 10)
      return isNaN(parsed) ? 0 : parsed
    })
  const max = existingIds.length > 0 ? Math.max(...existingIds) : 999
  return max + 1
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const AVATAR_COLOR_CLASSES = [
  'avatar-color-0',
  'avatar-color-1',
  'avatar-color-2',
  'avatar-color-3',
  'avatar-color-4',
  'avatar-color-5',
]

/** The exchange:ticker shown in the Primary listing column. */
const listingLabel = (company: CompanyFull) => {
  const listing = company.exchange_listings[0]
  return listing ? `${listing.exchange_id} · ${listing.ticker_code}` : null
}

/** Every sector category a company sits in — the values the Sectors column shows. */
const sectorTypes = (company: CompanyFull) => [
  ...new Set(company.sectors.map(s => s.sector_type).filter(Boolean)),
]

export default function CompaniesListPage() {
  const navigate = useNavigate()
  const { setOriginal } = useCompanyStore()

  // Every company on the wire — all 9,439 — served from the on-disk cache when
  // there is one, with anything created here folded in. See lib/api/repository.ts.
  // The API is read-only, so "+ New company" still writes locally.
  const { data, isLoading, isFetching, error: queryError } = useAllCompanies()
  const refresh = useRefreshRecords()
  // Memoised because every useMemo below depends on it: `data?.records ?? []`
  // evaluated inline is a fresh array each render, which would defeat all of them.
  const companies: CompanyFull[] = useMemo(() => data?.records ?? [], [data])
  // A reachable API that simply has nothing, versus one that could not be
  // reached — the second is worth saying, since the list then falls back to the
  // cache or to local records alone.
  const apiError = data?.error ?? (queryError as Error | null)

  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('name_en')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [letter, setLetter] = useState<string | null>(null)
  const [statusSel, setStatusSel] = useState<string[]>([])
  const [sectorSel, setSectorSel] = useState<string[]>([])
  const [exchangeSel, setExchangeSel] = useState<string[]>([])
  const [columns, setColumns] = useState<ColumnVisibility>({
    status: true,
    primaryListing: true,
    sectors: true,
    lastModified: true,
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

  // The filter menus are built from the whole set, not the visible page, so a
  // sector's count is the real one and a value can't disappear from the menu
  // just because the current page happens not to contain it.
  const statusOptions = useMemo(() => filterOptions(companies, c => c.status), [companies])
  const sectorOptions = useMemo(() => filterOptions(companies, sectorTypes), [companies])
  const exchangeOptions = useMemo(
    () => filterOptions(companies, c => c.exchange_listings.map(l => l.exchange_id).filter(Boolean)),
    [companies]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    const rows = companies.filter(c => {
      if (!passesFilter(statusSel, c.status)) return false
      if (!passesFilter(sectorSel, sectorTypes(c))) return false
      if (!passesFilter(exchangeSel, c.exchange_listings.map(l => l.exchange_id))) return false
      if (letter && initialOf(c.name_en) !== letter) return false
      if (q) {
        return (
          c.name_en.toLowerCase().includes(q) ||
          (c.name_ja?.toLowerCase().includes(q) ?? false) ||
          (c.name_zh_hans?.toLowerCase().includes(q) ?? false) ||
          (c.name_zh_hant?.toLowerCase().includes(q) ?? false) ||
          String(c.id).includes(q)
        )
      }
      return true
    })

    return rows.sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1
      if (sortField === 'name_en') return mult * a.name_en.localeCompare(b.name_en)
      if (sortField === 'id') return mult * (a.id - b.id)
      // API records have no timestamp, so they sort together at one end rather
      // than interleaving arbitrarily with the records that do.
      const av = a.updated_at || ''
      const bv = b.updated_at || ''
      return mult * (av > bv ? 1 : av < bv ? -1 : 0)
    })
  }, [companies, search, statusSel, sectorSel, exchangeSel, letter, sortField, sortDir])

  // Which first letters exist at all, so the index can grey out the rest. Taken
  // before the letter filter is applied — otherwise picking "F" would leave F
  // as the only enabled letter.
  const availableLetters = useMemo(
    () => new Set(companies.map(c => initialOf(c.name_en))),
    [companies]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  )

  // A new page starts at the top; keeping the old scroll offset would drop you
  // into the middle of a set of rows you haven't seen.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [safePage])

  const goToPage = (next: number) => setPage(next)

  const resetFilters = () => {
    setSearch('')
    setLetter(null)
    setStatusSel([])
    setSectorSel([])
    setExchangeSel([])
    setPage(1)
  }

  const filtersActive =
    !!search || letter !== null || statusSel.length > 0 || sectorSel.length > 0 || exchangeSel.length > 0

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'updated_at' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  // Company name A→Z, then Z→A, then by id — the id being the way to see the
  // newest records, since the wire gives no timestamps to sort on.
  const handleCompanySort = () => {
    if (sortField === 'name_en' && sortDir === 'asc') setSortDir('desc')
    else if (sortField === 'name_en' && sortDir === 'desc') { setSortField('id'); setSortDir('asc') }
    else { setSortField('name_en'); setSortDir('asc') }
    setPage(1)
  }

  const handleRowClick = (company: CompanyFull) => {
    setOriginal(company)
    navigate(`/companies/${company.id}`)
  }

  const handleNewCompany = () => {
    const company = blankCompany(generateCompanyId())
    saveCompany(company)
    setOriginal(company)
    navigate(`/companies/${company.id}`)
  }

  const formatDate = (iso: string) => {
    // API records have no timestamp at all — the wire exposes none — so this
    // has to render "no date" rather than NaN/NaN/NaN.
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return '—'
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}/${m}/${day}`
    } catch {
      return '—'
    }
  }

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="companies-page">
      <Topbar
        breadcrumb={<SectionNav current="companies" />}
        actions={
          <>
            {/* The sheet is an alternative surface onto these same records —
                same data, different interface, for bulk edits a form is bad at. */}
            <Button variant="outline" size="sm" onClick={() => navigate('/companies/sheet')}>
              Spreadsheet view
            </Button>
            <Button variant="primary" size="sm" onClick={handleNewCompany}>
              + New company
            </Button>
          </>
        }
      />

      <div className="companies-toolbar">
        <input
          className="field__input"
          type="text"
          placeholder="Search all companies..."
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
                  ['primaryListing', 'Primary listing'],
                  ['sectors', 'Sectors'],
                  ['lastModified', 'Last modified'],
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
          onRefresh={() => refresh('companies')}
        />
      </div>

      <AlphabetIndex
        available={availableLetters}
        value={letter}
        onChange={next => { setLetter(next); setPage(1) }}
      />

      {apiError && (
        <div className="companies-notice companies-notice--error">
          Could not reach the newswire API — showing {data?.origin === 'cache' ? 'the last synced copy' : 'locally saved companies only'}.
          <span className="hint"> {apiError.message}</span>
        </div>
      )}

      <div className="companies-table-wrap" ref={scrollRef}>
        {isLoading ? (
          <div className="companies-empty">
            <span>Loading all companies from the newswire…</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="companies-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span>No companies match your search.</span>
            {filtersActive && (
              <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>
            )}
          </div>
        ) : (
          <table className="companies-table">
            <thead>
              <tr>
                <th
                  className={sortField === 'name_en' || sortField === 'id' ? 'sorted' : undefined}
                  onClick={handleCompanySort}
                >
                  {sortField === 'id' ? 'ID' : 'Company'}
                  {sortField === 'name_en' || sortField === 'id'
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
                {columns.primaryListing && (
                  <th>
                    <span className="th__inner">
                      Primary listing
                      <ColumnFilter
                        label="Exchange"
                        options={exchangeOptions}
                        selected={exchangeSel}
                        onChange={next => { setExchangeSel(next); setPage(1) }}
                      />
                    </span>
                  </th>
                )}
                {columns.sectors && (
                  <th>
                    <span className="th__inner">
                      Sectors
                      <ColumnFilter
                        label="Sector"
                        options={sectorOptions}
                        selected={sectorSel}
                        onChange={next => { setSectorSel(next); setPage(1) }}
                      />
                    </span>
                  </th>
                )}
                {columns.lastModified && (
                  <th
                    className={sortField === 'updated_at' ? 'sorted' : undefined}
                    onClick={() => handleSort('updated_at')}
                  >
                    Modified{sortIcon('updated_at')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map(company => {
                const colorClass = AVATAR_COLOR_CLASSES[company.id % 6]
                const initials = getInitials(company.name_en)
                const listing = listingLabel(company)
                const sectors = sectorTypes(company).join(', ')

                return (
                  <tr key={company.id} onClick={() => handleRowClick(company)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {company.logo_article_url ? (
                          <img
                            src={company.logo_article_url}
                            alt={company.name_en}
                            className="company-avatar"
                            style={{ objectFit: 'contain' }}
                          />
                        ) : (
                          <div className={`company-avatar ${colorClass}`}>
                            {initials}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{company.name_en}</div>
                          <div className="hint monospace">
                            #{company.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    {columns.status && (
                      <td>
                        <span className={`badge badge--${company.status}`}>{company.status}</span>
                      </td>
                    )}
                    {columns.primaryListing && (
                      <td>
                        {listing ? (
                          <span className="label monospace">{listing}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                        )}
                      </td>
                    )}
                    {columns.sectors && (
                      <td>
                        {sectors ? (
                          <span className="sectors-cell">{sectors}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                        )}
                      </td>
                    )}
                    {columns.lastModified && (
                      <td>
                        <div className="text-[var(--text-sm)]">{formatDate(company.updated_at)}</div>
                        {company.updated_by_name && (
                          <div className="hint">
                            {company.updated_by_name}
                          </div>
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
              {companies.length.toLocaleString()} companies match
            </>
          ) : (
            <>
              <strong>{companies.length.toLocaleString()}</strong>{' '}
              {companies.length === 1 ? 'company' : 'companies'}
            </>
          )}
          {visible.length > 0 && (
            <span className="hint">
              {' '}· showing {((safePage - 1) * PAGE_SIZE + 1).toLocaleString()}–
              {((safePage - 1) * PAGE_SIZE + visible.length).toLocaleString()}
            </span>
          )}
        </span>

        <Pagination page={safePage} onPage={goToPage} totalPages={totalPages} busy={isLoading} />
      </div>
    </div>
  )
}
