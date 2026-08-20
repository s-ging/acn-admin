import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../../store/company.store'
import { Button } from '../../components/ui/Button'
import { Topbar } from '../../components/ui/Topbar'
import { loadCompanies, saveCompany } from '../../lib/companies/storage'
import { blankCompany } from '../../lib/companies/blank'
import type { CompanyFull, CompanyStatus } from '../../types/company.types'

type SortField = 'name_en' | 'updated_at' | 'id'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | CompanyStatus

interface ColumnVisibility {
  status: boolean
  primaryListing: boolean
  sectors: boolean
  lastModified: boolean
}

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

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All statuses',
  active: 'Active',
  draft: 'Draft',
  inactive: 'Inactive',
}

export default function CompaniesListPage() {
  const navigate = useNavigate()
  const { setOriginal } = useCompanyStore()

  const [companies] = useState<CompanyFull[]>(() => loadCompanies())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortField, setSortField] = useState<SortField>('updated_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [columns, setColumns] = useState<ColumnVisibility>({
    status: true,
    primaryListing: true,
    sectors: true,
    lastModified: true,
  })
  const [colDropdownOpen, setColDropdownOpen] = useState(false)
  const colDropdownRef = useRef<HTMLDivElement>(null)

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

  const handleCompanySort = () => {
    if (sortField === 'name_en' && sortDir === 'asc') {
      setSortDir('desc')
    } else if (sortField === 'name_en' && sortDir === 'desc') {
      setSortField('id')
      setSortDir('asc')
    } else {
      setSortField('name_en')
      setSortDir('asc')
    }
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

  const filtered = companies
    .filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          c.name_en.toLowerCase().includes(q) ||
          (c.name_ja?.toLowerCase().includes(q) ?? false) ||
          (c.name_zh_hans?.toLowerCase().includes(q) ?? false) ||
          String(c.id).includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1
      if (sortField === 'name_en') {
        return mult * a.name_en.localeCompare(b.name_en)
      }
      if (sortField === 'id') {
        return mult * (a.id - b.id)
      }
      return mult * (a.updated_at > b.updated_at ? 1 : a.updated_at < b.updated_at ? -1 : 0)
    })

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
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
            <span style={{ color: 'var(--color-text-tertiary)' }}>Home</span>
            {' › '}
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>Companies</span>
          </>
        }
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
          placeholder="Search companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '150px' }}
        />

        <select
          className="toolbar-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
        >
          {(['all', 'active', 'draft', 'inactive'] as StatusFilter[]).map(s => (
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

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {filtered.length} {filtered.length === 1 ? 'company loaded' : 'companies loaded'}
        </span>
      </div>

      <div className="companies-table-wrap">
        {filtered.length === 0 ? (
          <div className="companies-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span>No companies match your search.</span>
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
                {columns.status && <th>Status</th>}
                {columns.primaryListing && <th>Primary listing</th>}
                {columns.sectors && <th>Sectors</th>}
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
              {filtered.map(company => {
                const colorClass = AVATAR_COLOR_CLASSES[company.id % 6]
                const initials = getInitials(company.name_en)
                const primaryListing = company.exchange_listings[0]
                const sectors = [...new Set(company.sectors.map(s => s.sector_type))].join(', ')

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
                        {primaryListing ? (
                          <span className="label monospace">
                            {primaryListing.exchange_id} · {primaryListing.ticker_code}
                          </span>
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

      <div className="companies-footer">
        <span>Showing {filtered.length} of {companies.length} {companies.length === 1 ? 'company' : 'companies'}</span>
      </div>
    </div>
  )
}
