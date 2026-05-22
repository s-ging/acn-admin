import { useState, useCallback } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { TrashIcon } from '../../ui/TrashIcon'
import { MOCK_SECTORS } from '../../../lib/mock'
import type { CompanySector } from '../../../types/company.types'

const EMPTY_SVG = `<svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"><g opacity="0.3"><path d="M36 66V39" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M45.5101 6.63126C46.2572 6.21349 47.099 5.99414 47.9551 5.99414C48.8111 5.99414 49.6529 6.21349 50.4001 6.63126L63.0001 13.7113C63.8924 14.2159 64.6348 14.9483 65.1513 15.8338C65.6679 16.7193 65.9401 17.7261 65.9401 18.7513C65.9401 19.7764 65.6679 20.7832 65.1513 21.6687C64.6348 22.5542 63.8924 23.2867 63.0001 23.7913L26.4601 44.3713C25.7107 44.7987 24.8628 45.0235 24.0001 45.0235C23.1373 45.0235 22.2895 44.7987 21.5401 44.3713L9.00006 37.2913C8.1077 36.7867 7.36532 36.0542 6.84878 35.1687C6.33224 34.2832 6.06006 33.2764 6.06006 32.2513C6.06006 31.2261 6.33224 30.2193 6.84878 29.3338C7.36532 28.4484 8.1077 27.7159 9.00006 27.2113L45.5101 6.63126Z" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M60 39V50.61C60.0012 51.7423 59.6912 52.8533 59.104 53.8214C58.5167 54.7896 57.6748 55.5778 56.67 56.1L38.67 65.34C37.8453 65.7686 36.9295 65.9924 36 65.9924C35.0705 65.9924 34.1547 65.7686 33.33 65.34L15.33 56.1C14.3253 55.5778 13.4833 54.7896 12.896 53.8214C12.3088 52.8533 11.9988 51.7423 12 50.61V39" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M63.0001 37.2878C63.8924 36.7832 64.6348 36.0507 65.1513 35.1652C65.6679 34.2797 65.9401 33.2729 65.9401 32.2478C65.9401 31.2226 65.6679 30.2159 65.1513 29.3304C64.6348 28.4449 63.8924 27.7124 63.0001 27.2078L26.4901 6.5978C25.7457 6.17152 24.9028 5.94727 24.0451 5.94727C23.1873 5.94727 22.3444 6.17152 21.6001 6.5978L9.00006 13.7078C8.1077 14.2124 7.36532 14.9449 6.84878 15.8304C6.33224 16.7159 6.06006 17.7226 6.06006 18.7478C6.06006 19.7729 6.33224 20.7797 6.84878 21.6652C7.36532 22.5507 8.1077 23.2832 9.00006 23.7878L45.5401 44.3678C46.284 44.7952 47.127 45.0202 47.9851 45.0202C48.8431 45.0202 49.6861 44.7952 50.4301 44.3678L63.0001 37.2878Z" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`

function EmptyState({ label }: { label: string }) {
  return (
    <div className="empty-state">
      <div dangerouslySetInnerHTML={{ __html: EMPTY_SVG }} />
      <span className="label">No records to show. Add a {label}</span>
    </div>
  )
}

function SectorSearchPanel({ onSave, onCancel }: {
  onSave: (selected: typeof MOCK_SECTORS) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const filtered = MOCK_SECTORS.filter(s => {
    const q = query.toLowerCase()
    return s.sector_name.toLowerCase().includes(q) || s.sector_type.toLowerCase().includes(q)
  })

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div className="contact-card" style={{ marginBottom: 16 }}>
      <div className="label">Add sector</div>
      <div className="wire-search">
        <div className="wire-search__input-row">
          <span className="wire-search__icon">○</span>
          <input
            className="wire-search__input"
            placeholder="Search by sector name or type"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="wire-search__results">
          {filtered.map(s => (
            <div key={s.id} className="wire-search__row">
              <div className="wire-search__info">
                <span className="wire-search__name">{s.sector_name}</span>
                <span className="wire-search__meta">{s.sector_type}</span>
              </div>
              <button
                className={`wire-search__add ${selected.has(s.id) ? 'wire-search__add--selected' : ''}`}
                onClick={() => toggle(s.id)}
              >
                {selected.has(s.id) ? '✓' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="contact-form__divider" />
      <div className="contact-form__actions" style={{ padding: '12px 16px' }}>
        <Button variant="danger" size="sm" onClick={onCancel}>✕ Cancel entry</Button>
        <Button variant="outline" size="sm" onClick={() => onSave(MOCK_SECTORS.filter(s => selected.has(s.id)))}>Save changes</Button>
      </div>
    </div>
  )
}

export default function CompanyDetailsTab() {
  const draft = useCompanyStore(s => s.draft)
  const updateDraft = useCompanyStore(s => s.updateDraft)
  const [addingSector, setAddingSector] = useState(false)

  const update = useCallback((field: string, value: string) => {
    updateDraft({ [field]: value || null } as never)
  }, [updateDraft])

  const handleSaveSectors = useCallback((selected: typeof MOCK_SECTORS) => {
    if (!draft) return
    const newSectors: CompanySector[] = selected.map(s => ({
      id: Date.now() + s.id,
      company_id: draft.id,
      sector_id: s.id,
      sector_type: s.sector_type,
      sector_name: s.sector_name
    }))
    const existingIds = new Set(draft.sectors.map(s => s.sector_id))
    const toAdd = newSectors.filter(s => !existingIds.has(s.sector_id))
    updateDraft({ sectors: [...draft.sectors, ...toAdd] })
    setAddingSector(false)
  }, [draft, updateDraft])

  const handleDeleteSector = useCallback((sectorId: number) => {
    if (!draft) return
    updateDraft({ sectors: draft.sectors.filter(s => s.sector_id !== sectorId) })
  }, [draft, updateDraft])

  if (!draft) return null

  return (
    <div className="tab-content">

      {/* Company Profile */}
      <section className="field-section">
        <div className="section-label">Company Profile</div>
        <div className="field-row field-row--3" style={{ marginTop: 16 }}>
          <Field label="Established" value={draft.established ?? ''} placeholder="e.g. 1971/02/01" onChange={e => update('established', e.target.value)} />
          <Field label="Exchange Listed Date" value={draft.exchange_listed_date ?? ''} placeholder="e.g. 1971/02/01" onChange={e => update('exchange_listed_date', e.target.value)} />
          <Field label="Employees" value={draft.employees ?? ''} placeholder="e.g. 1000+" onChange={e => update('employees', e.target.value)} />
        </div>
        <div className="field-row field-row--3" style={{ marginTop: 24 }}>
          <Field label="DUNS number" value={draft.duns_number ?? ''} placeholder="e.g. 00-123-4567" onChange={e => update('duns_number', e.target.value)} />
          <Field label="OTC" value={draft.otc ?? ''} placeholder="https://www.mhi.com/news" onChange={e => update('otc', e.target.value)} />
          <Field label="Market ID" value={draft.market_id ?? ''} placeholder="https://www.mhi.com/news" onChange={e => update('market_id', e.target.value)} />
        </div>
      </section>

      {/* Company Links */}
      <section className="field-section">
        <div className="section-label">Company Links</div>
        <div className="field-row field-row--3" style={{ marginTop: 16 }}>
          <Field label="Company Website" value={draft.url ?? ''} onChange={e => update('url', e.target.value)} />
          <Field label="Company Website (JA)" value={draft.url_ja ?? ''} onChange={e => update('url_ja', e.target.value)} />
          <Field label="Blog" value={draft.blog ?? ''} onChange={e => update('blog', e.target.value)} />
        </div>
        <div className="field-row field-row--3" style={{ marginTop: 24 }}>
          <Field label="Facebook" value={draft.facebook ?? ''} onChange={e => update('facebook', e.target.value)} />
          <Field label="Twitter" value={draft.twitter ?? ''} onChange={e => update('twitter', e.target.value)} />
          <Field label="Instagram" value={draft.instagram ?? ''} onChange={e => update('instagram', e.target.value)} />
        </div>
        <div className="field-row field-row--3" style={{ marginTop: 24 }}>
          <Field label="LinkedIn" value={draft.linkedin ?? ''} onChange={e => update('linkedin', e.target.value)} />
          <Field label="YouTube" value={draft.youtube ?? ''} onChange={e => update('youtube', e.target.value)} />
          <Field label="Telegram" value={draft.telegram ?? ''} onChange={e => update('telegram', e.target.value)} />
        </div>
      </section>

      {/* Company Address */}
      <section className="field-section">
        <div className="section-label">Company Address</div>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Field label="Street" value={draft.address_street ?? ''} placeholder="e.g. 2-3, Marunouchi 3-chome" onChange={e => update('address_street', e.target.value)} />
          <Field label="District" value={draft.address_district ?? ''} placeholder="e.g. Chiyoda-ku" onChange={e => update('address_district', e.target.value)} />
          <Field label="City" value={draft.address_city ?? ''} placeholder="e.g. Tokyo 100-8332" onChange={e => update('address_city', e.target.value)} />
          <Field label="Country" value={draft.address_country ?? ''} placeholder="e.g. Japan" onChange={e => update('address_country', e.target.value)} />
        </div>
        <div className="field-row field-row--3" style={{ marginTop: 24 }}>
          <Field label="Company Telephone" value={draft.telephone ?? ''} placeholder="+81 3 0000 0000" onChange={e => update('telephone', e.target.value)} />
          <Field label="Facsimile" value={draft.facsimile ?? ''} placeholder="+81 3 0000 0000" onChange={e => update('facsimile', e.target.value)} />
          <Field label="Company Email" value={draft.company_email ?? ''} placeholder="e.g. hello@mhi.com.jp" onChange={e => update('company_email', e.target.value)} />
        </div>
      </section>

      {/* Key Personnel */}
      <section className="field-section">
        <div className="field-row field-row--2" style={{ marginBottom: 24 }}>
          <Field label="Key Personnel 1 Name" value={draft.key_person_1_name ?? ''} onChange={e => update('key_person_1_name', e.target.value)} />
          <Field label="Key Personnel 1 Title" value={draft.key_person_1_title ?? ''} onChange={e => update('key_person_1_title', e.target.value)} />
        </div>
        <div className="field-row field-row--2">
          <Field label="Key Personnel 2 Name" value={draft.key_person_2_name ?? ''} onChange={e => update('key_person_2_name', e.target.value)} />
          <Field label="Key Personnel 2 Title" value={draft.key_person_2_title ?? ''} onChange={e => update('key_person_2_title', e.target.value)} />
        </div>
      </section>

      {/* Company Sectors */}
      <section className="field-section">
        <div className="section-header">
          <span className="section-header__title">Company Sectors</span>
          <div className="section-header__actions">
            <Button variant="outline" size="sm" onClick={() => setAddingSector(true)}>+ Add sector</Button>
            <Button variant="outline" size="sm">↓ Import from CSV</Button>
          </div>
        </div>

        {addingSector && (
          <SectorSearchPanel
            onSave={handleSaveSectors}
            onCancel={() => setAddingSector(false)}
          />
        )}

        {draft.sectors.length === 0 ? (
          <EmptyState label="Sector" />
        ) : (
          <div className="data-table">
            <div className="data-table__header sectors-grid">
              <span>Sector</span>
              <span>Industry</span>
              <span />
            </div>
            {draft.sectors.map(s => (
              <div key={s.sector_id} className="data-table__row sectors-grid">
                <span>{s.sector_type}</span>
                <span className="data-table__secondary">{s.sector_name}</span>
                <button className="data-table__delete" onClick={() => handleDeleteSector(s.sector_id)}><TrashIcon /></button>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}
