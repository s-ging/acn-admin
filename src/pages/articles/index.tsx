import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useArticleStore } from '../../store/article.store'
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
import { useArticlePage, useArticleTotal, useRefreshRecords } from '../../hooks/useRecords'
import type { PressRelease } from '../../types/press-release.types'

// The list-page shell (.companies-page, .companies-table, …) is generic despite
// the name — same convention as the commit-* modal shell.

type SortField = 'headline' | 'published_at' | 'id'
type SortDir = 'asc' | 'desc'

interface ColumnVisibility {
  status: boolean
  company: boolean
  classification: boolean
  /** The wire tags every release with a language; it is worth filtering on. */
  language: boolean
  region: boolean
  published: boolean
}

// One request's worth of releases. The server caps a page at 100; 50 keeps the
// table quick to scan and the round trip short.
const PAGE_SIZE = 50


export default function ArticlesListPage() {
  const navigate = useNavigate()
  const setOriginal = useArticleStore(s => s.setOriginal)

  // Releases come off the ACN Newswire API a page at a time — there are 78,874
  // of them, so unlike companies this list cannot hold the lot. Anything drafted
  // here is folded into every page. The API is read-only, so "+ New press
  // release" still writes locally.
  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching, error: queryError } = useArticlePage({ page, size: PAGE_SIZE })
  // The total is a separate query: discovering it costs ~10 requests because the
  // API publishes no count, and it changes far more slowly than a page does.
  const { data: total } = useArticleTotal()
  const refresh = useRefreshRecords()
  // Memoised for the same reason as `companies` on the companies list.
  const articles: PressRelease[] = useMemo(() => data?.records ?? [], [data])
  const apiError = data?.error ?? (queryError as Error | null)

  const [letter, setLetter] = useState<string | null>(null)
  const [statusSel, setStatusSel] = useState<string[]>([])
  const [sectorSel, setSectorSel] = useState<string[]>([])
  const [issuerSel, setIssuerSel] = useState<string[]>([])
  const [langSel, setLangSel] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('published_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [columns, setColumns] = useState<ColumnVisibility>({
    status: true,
    company: true,
    classification: true,
    language: true,
    region: false,
    published: true,
  })
  const [colDropdownOpen, setColDropdownOpen] = useState(false)
  const colDropdownRef = useRef<HTMLDivElement>(null)

  // Releases store company ids; the list shows names. The API sends the name on
  // each row, so they arrive with the records — see ArticleListResult.
  const companyNames = useMemo(
    () => data?.companyNames ?? new Map<number, string>(),
    [data]
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colDropdownRef.current && !colDropdownRef.current.contains(e.target as Node)) {
        setColDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // Headline → headline desc → article id, mirroring the companies column.
  const handleHeadlineSort = () => {
    if (sortField === 'headline' && sortDir === 'asc') {
      setSortDir('desc')
    } else if (sortField === 'headline' && sortDir === 'desc') {
      setSortField('id')
      setSortDir('asc')
    } else {
      setSortField('headline')
      setSortDir('asc')
    }
  }

  const handleRowClick = (article: PressRelease) => {
    setOriginal(article)
    navigate(`/article/${article.id}`)
  }

  // The primary issuer, with a count of the other companies credited alongside it.
  const companyLabel = (article: PressRelease) => {
    const issuer = article.primary_issuer_id !== null
      ? companyNames.get(article.primary_issuer_id)
      : undefined
    if (!issuer) return null
    const others = article.company_ids.length - 1
    return others > 0 ? `${issuer} +${others}` : issuer
  }

  // The issuer name each release is filed under — the value the issuer filter
  // and the A–Z index both key on.
  const issuerName = (article: PressRelease) =>
    article.primary_issuer_id !== null
      ? companyNames.get(article.primary_issuer_id) ?? null
      : null

  // Filter menus are built from the page in hand, because that is all the wire
  // gave us. See the note by the search box.
  const statusOptions = useMemo(() => filterOptions(articles, a => a.status), [articles])
  const sectorOptions = useMemo(
    () => filterOptions(articles, a => [a.sector_type, ...a.industries].filter(Boolean) as string[]),
    [articles]
  )
  const issuerOptions = useMemo(
    () => filterOptions(articles, issuerName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [articles, companyNames]
  )
  const langOptions = useMemo(() => filterOptions(articles, a => a.languages), [articles])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    const rows = articles.filter(a => {
      if (!passesFilter(statusSel, a.status)) return false
      if (!passesFilter(sectorSel, [a.sector_type, ...a.industries].filter(Boolean) as string[])) return false
      if (!passesFilter(issuerSel, issuerName(a))) return false
      if (!passesFilter(langSel, a.languages)) return false
      if (letter && initialOf(a.headline) !== letter) return false
      if (q) {
        return (
          a.headline.toLowerCase().includes(q) ||
          a.article_id.toLowerCase().includes(q) ||
          (a.subheadline?.toLowerCase().includes(q) ?? false) ||
          (issuerName(a)?.toLowerCase().includes(q) ?? false) ||
          String(a.id).includes(q)
        )
      }
      return true
    })

    return rows.sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1
      if (sortField === 'headline') return mult * a.headline.localeCompare(b.headline)
      if (sortField === 'id') return mult * (a.id - b.id)
      // Unpublished releases sort last on the way down, first on the way up.
      const av = a.published_at ?? ''
      const bv = b.published_at ?? ''
      return mult * (av > bv ? 1 : av < bv ? -1 : 0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, companyNames, search, statusSel, sectorSel, issuerSel, langSel, letter, sortField, sortDir])

  const availableLetters = useMemo(
    () => new Set(articles.map(a => initialOf(a.headline))),
    [articles]
  )

  // A new page starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [page])

  const resetFilters = () => {
    setSearch('')
    setLetter(null)
    setStatusSel([])
    setSectorSel([])
    setIssuerSel([])
    setLangSel([])
  }

  const filtersActive =
    !!search || letter !== null || statusSel.length > 0 || sectorSel.length > 0 ||
    issuerSel.length > 0 || langSel.length > 0

  /** Total pages, once the total is known. Null while it is still being discovered. */
  const totalPages = typeof total === 'number' ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return '—'
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
        breadcrumb={<SectionNav current="articles" />}
        actions={
          <>
            {/* The sheet is an alternative surface onto these same records —
                same data, different interface, for bulk edits a form is bad at. */}
            <Button variant="outline" size="sm" onClick={() => navigate('/article/sheet')}>
              Spreadsheet view
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/article/new')}>
              + New press release
            </Button>
          </>
        }
      />

      <div className="companies-toolbar">
        <input
          className="field__input"
          type="text"
          placeholder="Search this page..."
          value={search}
          onChange={e => setSearch(e.target.value)}
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
                  ['company', 'Primary issuer'],
                  ['classification', 'Classification'],
                  ['language', 'Language'],
                  ['region', 'Region'],
                  ['published', 'Published'],
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

        {/* Search and the column filters run over the page in hand, not the whole
            wire: 78,874 releases cannot be held in the browser, and the API's own
            search endpoint is exact-match only (see endpoints.ts). Companies are
            different — the whole set is loaded there, so its filters are global. */}
        <SyncStatus
          origin={data?.origin}
          syncedAt={data?.syncedAt ?? null}
          busy={isFetching}
          onRefresh={() => refresh('articles')}
        />
      </div>

      <AlphabetIndex available={availableLetters} value={letter} onChange={setLetter} />

      {apiError && (
        <div className="companies-notice companies-notice--error">
          Could not reach the newswire API — showing {data?.origin === 'cache' ? 'the last synced copy of this page' : 'locally saved releases only'}.
          <span className="hint"> {apiError.message}</span>
        </div>
      )}

      <div className="companies-table-wrap" ref={scrollRef}>
        {isLoading ? (
          <div className="companies-empty">
            <span>Loading press releases from the newswire…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="companies-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span>
              {articles.length === 0
                ? 'No press releases yet.'
                : 'No press releases match your search.'}
            </span>
          </div>
        ) : (
          <table className="companies-table">
            <thead>
              <tr>
                <th
                  className={sortField === 'headline' || sortField === 'id' ? 'sorted' : undefined}
                  onClick={handleHeadlineSort}
                >
                  {sortField === 'id' ? 'Article ID' : 'Release'}
                  {sortField === 'headline' || sortField === 'id'
                    ? (sortDir === 'asc' ? ' ↑' : ' ↓')
                    : ' ↕'}
                </th>
                {columns.status && (
                  <th>
                    <span className="th__inner">
                      Status
                      <ColumnFilter label="Status" options={statusOptions} selected={statusSel} onChange={setStatusSel} />
                    </span>
                  </th>
                )}
                {columns.company && (
                  <th>
                    <span className="th__inner">
                      Primary issuer
                      <ColumnFilter label="Issuer" options={issuerOptions} selected={issuerSel} onChange={setIssuerSel} />
                    </span>
                  </th>
                )}
                {columns.classification && (
                  <th>
                    <span className="th__inner">
                      Classification
                      <ColumnFilter label="Sector" options={sectorOptions} selected={sectorSel} onChange={setSectorSel} />
                    </span>
                  </th>
                )}
                {columns.language && (
                  <th>
                    <span className="th__inner">
                      Language
                      <ColumnFilter label="Language" options={langOptions} selected={langSel} onChange={setLangSel} />
                    </span>
                  </th>
                )}
                {columns.region && <th>Region</th>}
                {columns.published && (
                  <th
                    className={sortField === 'published_at' ? 'sorted' : undefined}
                    onClick={() => handleSort('published_at')}
                  >
                    Published{sortIcon('published_at')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map(article => {
                const company = companyLabel(article)
                const classification = [article.sector_type, ...article.industries]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <tr key={article.id} onClick={() => handleRowClick(article)}>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {article.headline || 'Untitled'}
                      </div>
                      <div className="hint monospace">{article.article_id}</div>
                    </td>
                    {columns.status && (
                      <td>
                        <span className={`badge badge--${article.status}`}>{article.status}</span>
                      </td>
                    )}
                    {columns.company && (
                      <td>
                        {company ? (
                          <span className="sectors-cell" title={company}>{company}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                        )}
                      </td>
                    )}
                    {columns.classification && (
                      <td>
                        {classification ? (
                          <span className="sectors-cell" title={classification}>
                            {classification}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                        )}
                      </td>
                    )}
                    {columns.language && (
                      <td>
                        {article.languages.length > 0 ? (
                          <span className="label monospace">{article.languages.join(', ')}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                        )}
                      </td>
                    )}
                    {columns.region && (
                      <td>
                        {article.region ? (
                          <span className="sectors-cell">{article.region}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                        )}
                      </td>
                    )}
                    {columns.published && (
                      <td>
                        <div className="text-[var(--text-sm)]">{formatDate(article.published_at)}</div>
                        {article.report_by && (
                          <div className="hint">{article.report_by}</div>
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

      <BackToTop targetRef={scrollRef} resetKey={page} />

      <div className="companies-footer">
        <span>
          {typeof total === 'number' ? (
            <>
              <strong>{total.toLocaleString()}</strong> press releases
            </>
          ) : (
            <>Counting press releases…</>
          )}
          <span className="hint">
            {' '}· {filtered.length}
            {filtersActive ? ` of ${articles.length}` : ''} on this page
          </span>
        </span>

        <Pagination
          page={page}
          onPage={setPage}
          totalPages={totalPages}
          hasMore={data?.hasMore}
          busy={isFetching}
        />
      </div>
    </div>
  )
}
