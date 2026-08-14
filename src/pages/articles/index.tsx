import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useArticleStore } from '../../store/article.store'
import { Button } from '../../components/ui/Button'
import { Topbar } from '../../components/ui/Topbar'
import { loadArticles } from '../../lib/press-releases/storage'
import { loadCompanies } from '../../lib/companies/storage'
import type { PressRelease, ArticleStatus } from '../../types/press-release.types'

// The list-page shell (.companies-page, .companies-table, …) is generic despite
// the name — same convention as the commit-* modal shell.

type SortField = 'headline' | 'published_at' | 'id'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | ArticleStatus

interface ColumnVisibility {
  status: boolean
  company: boolean
  classification: boolean
  region: boolean
  published: boolean
}

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All statuses',
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
}

export default function ArticlesListPage() {
  const navigate = useNavigate()
  const setOriginal = useArticleStore(s => s.setOriginal)

  const [articles] = useState<PressRelease[]>(() => loadArticles())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortField, setSortField] = useState<SortField>('published_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [columns, setColumns] = useState<ColumnVisibility>({
    status: true,
    company: true,
    classification: true,
    region: true,
    published: true,
  })
  const [colDropdownOpen, setColDropdownOpen] = useState(false)
  const colDropdownRef = useRef<HTMLDivElement>(null)

  // Releases store company ids; the list shows names.
  const companyNames = useMemo(() => {
    const map = new Map<number, string>()
    loadCompanies().forEach(c => map.set(c.id, c.name_en))
    return map
  }, [])

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

  const filtered = articles
    .filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          a.headline.toLowerCase().includes(q) ||
          a.article_id.toLowerCase().includes(q) ||
          (a.subheadline?.toLowerCase().includes(q) ?? false) ||
          (companyLabel(a)?.toLowerCase().includes(q) ?? false) ||
          String(a.id).includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1
      if (sortField === 'headline') {
        return mult * a.headline.localeCompare(b.headline)
      }
      if (sortField === 'id') {
        return mult * (a.id - b.id)
      }
      // Unpublished releases sort last on the way down, first on the way up.
      const av = a.published_at ?? ''
      const bv = b.published_at ?? ''
      return mult * (av > bv ? 1 : av < bv ? -1 : 0)
    })

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
        breadcrumb={
          <>
            <span
              style={{ cursor: 'pointer', color: 'var(--color-text-secondary)' }}
              onClick={() => navigate('/companies')}
            >
              Home
            </span>
            {' › '}
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>Press Releases</span>
          </>
        }
        actions={
          <Button variant="primary" size="sm" onClick={() => navigate('/article/new')}>
            + New press release
          </Button>
        }
      />

      <div className="companies-toolbar">
        <input
          className="field__input"
          type="text"
          placeholder="Search press releases..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '150px' }}
        />

        <select
          className="toolbar-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
        >
          {(['all', 'draft', 'scheduled', 'published', 'archived'] as StatusFilter[]).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

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

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {filtered.length} {filtered.length === 1 ? 'release loaded' : 'releases loaded'}
        </span>
      </div>

      <div className="companies-table-wrap">
        {filtered.length === 0 ? (
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
                {columns.status && <th>Status</th>}
                {columns.company && <th>Primary issuer</th>}
                {columns.classification && <th>Classification</th>}
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

      <div className="companies-footer">
        <span>
          Showing {filtered.length} of {articles.length}{' '}
          {articles.length === 1 ? 'press release' : 'press releases'}
        </span>
      </div>
    </div>
  )
}
