import { memo, useState, useCallback } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { TrashIcon } from '../../ui/TrashIcon'
import { MOCK_REUTERS_CODES, MOCK_BLOOMBERG_CODES } from '../../../lib/mock'
import type { ExchangeListing, CompanyWireCode } from '../../../types/company.types'

const EMPTY_SVG = `<svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"><g opacity="0.3"><path d="M36 66V39" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M45.5101 6.63126C46.2572 6.21349 47.099 5.99414 47.9551 5.99414C48.8111 5.99414 49.6529 6.21349 50.4001 6.63126L63.0001 13.7113C63.8924 14.2159 64.6348 14.9483 65.1513 15.8338C65.6679 16.7193 65.9401 17.7261 65.9401 18.7513C65.9401 19.7764 65.6679 20.7832 65.1513 21.6687C64.6348 22.5542 63.8924 23.2867 63.0001 23.7913L26.4601 44.3713C25.7107 44.7987 24.8628 45.0235 24.0001 45.0235C23.1373 45.0235 22.2895 44.7987 21.5401 44.3713L9.00006 37.2913C8.1077 36.7867 7.36532 36.0542 6.84878 35.1687C6.33224 34.2832 6.06006 33.2764 6.06006 32.2513C6.06006 31.2261 6.33224 30.2193 6.84878 29.3338C7.36532 28.4484 8.1077 27.7159 9.00006 27.2113L45.5401 6.63126Z" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M60 39V50.61C60.0012 51.7423 59.6912 52.8533 59.104 53.8214C58.5167 54.7896 57.6748 55.5778 56.67 56.1L38.67 65.34C37.8453 65.7686 36.9295 65.9924 36 65.9924C35.0705 65.9924 34.1547 65.7686 33.33 65.34L15.33 56.1C14.3253 55.5778 13.4833 54.7896 12.896 53.8214C12.3088 52.8533 11.9988 51.7423 12 50.61V39" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M63.0001 37.2878C63.8924 36.7832 64.6348 36.0507 65.1513 35.1652C65.6679 34.2797 65.9401 33.2729 65.9401 32.2478C65.9401 31.2226 65.6679 30.2159 65.1513 29.3304C64.6348 28.4449 63.8924 27.7124 63.0001 27.2078L26.4901 6.5978C25.7457 6.17152 24.9028 5.94727 24.0451 5.94727C23.1873 5.94727 22.3444 6.17152 21.6001 6.5978L9.00006 13.7078C8.1077 14.2124 7.36532 14.9449 6.84878 15.8304C6.33224 16.7159 6.06006 17.7226 6.06006 18.7478C6.06006 19.7729 6.33224 20.7797 6.84878 21.6652C7.36532 22.5507 8.1077 23.2832 9.00006 23.7878L45.5401 44.3678C46.284 44.7952 47.127 45.0202 47.9851 45.0202C48.8431 45.0202 49.6861 44.7952 50.4301 44.3678L63.0001 37.2878Z" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`

function EmptyState({ label }: { label: string }) {
  return (
    <div className="empty-state">
      <div dangerouslySetInnerHTML={{ __html: EMPTY_SVG }} />
      <span className="label">No records to show. Add a {label}</span>
    </div>
  )
}

interface ListingFormState {
  exchange_id: string
  exchange_name: string
  ticker_code: string
  isin: string
  sedol: string
  cusip: string
}

const EMPTY_LISTING: ListingFormState = {
  exchange_id: '', exchange_name: '', ticker_code: '', isin: '', sedol: '', cusip: ''
}

function ListingForm({ initial, onSave, onCancel }: {
  initial: ListingFormState
  onSave: (data: ListingFormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(initial)
  const set = (field: keyof ListingFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="contact-form">
      <div className="contact-form__row contact-form__row--3">
        <Field label="Exchange Code" value={form.exchange_id} placeholder="e.g. XTKS" onChange={e => set('exchange_id', e.target.value)} />
        <Field label="Exchange" value={form.exchange_name} placeholder="e.g. Tokyo Stock Exchange" onChange={e => set('exchange_name', e.target.value)} />
        <Field label="Ticker Code" value={form.ticker_code} placeholder="e.g. 7011" onChange={e => set('ticker_code', e.target.value)} />
      </div>
      <div className="contact-form__row contact-form__row--3">
        <Field label="ISIN" value={form.isin} placeholder="e.g. JP3900000005" onChange={e => set('isin', e.target.value)} />
        <Field label="SEDOL (optional)" value={form.sedol} placeholder="7 alphanumeric characters" onChange={e => set('sedol', e.target.value)} />
        <Field label="CUSIP (optional)" value={form.cusip} placeholder="9 alphanumeric characters" onChange={e => set('cusip', e.target.value)} />
      </div>
      <div className="contact-form__divider" />
      <div className="contact-form__actions">
        <Button variant="danger" size="sm" onClick={onCancel}>✕ Cancel entry</Button>
        <Button variant="outline" size="sm" onClick={() => onSave(form)}>Save changes</Button>
      </div>
    </div>
  )
}

function CodeSearchPanel({ title, masterList, onSave, onCancel }: {
  title: string
  masterList: { id: number; code: string; name: string }[]
  onSave: (selected: { id: number; code: string; name: string }[]) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const filtered = masterList.filter(c => {
    const q = query.toLowerCase()
    return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  })

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div className="contact-card" style={{ marginBottom: 16 }}>
      <div className="label">{title}</div>
      <div className="wire-search">
        <div className="wire-search__input-row">
          <span className="wire-search__icon">○</span>
          <input
            className="wire-search__input"
            placeholder="Search by name, email, or country"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="wire-search__results">
          {filtered.map(c => (
            <div key={c.id} className="wire-search__row">
              <div className="wire-search__info">
                <span className="wire-search__name">{c.code}</span>
                <span className="wire-search__meta">{c.name}</span>
              </div>
              <button
                className={`wire-search__add ${selected.has(c.id) ? 'wire-search__add--selected' : ''}`}
                onClick={() => toggle(c.id)}
              >
                {selected.has(c.id) ? '✓' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="contact-form__divider" />
      <div className="contact-form__actions" style={{ padding: '12px 16px' }}>
        <Button variant="danger" size="sm" onClick={onCancel}>✕ Cancel entry</Button>
        <Button variant="outline" size="sm" onClick={() => onSave(masterList.filter(c => selected.has(c.id)))}>Save changes</Button>
      </div>
    </div>
  )
}

const IdentifiersTab = memo(function IdentifiersTab() {
  const draft = useCompanyStore(s => s.draft)
  const updateDraft = useCompanyStore(s => s.updateDraft)

  const [addingListing, setAddingListing] = useState(false)
  const [editingListingId, setEditingListingId] = useState<number | null>(null)
  const [addingReuters, setAddingReuters] = useState(false)
  const [addingBloomberg, setAddingBloomberg] = useState(false)

  const handleSaveListing = useCallback((data: ListingFormState) => {
    if (!draft) return
    if (editingListingId !== null) {
      const updated = draft.exchange_listings.map(e =>
        e.id === editingListingId ? { ...e, ...data, isin: data.isin || null, sedol: data.sedol || null, cusip: data.cusip || null } : e
      )
      updateDraft({ exchange_listings: updated })
      setEditingListingId(null)
    } else {
      const newListing: ExchangeListing = {
        id: Date.now(),
        company_id: draft.id,
        exchange_id: data.exchange_id,
        exchange_name: data.exchange_name,
        ticker_code: data.ticker_code,
        isin: data.isin || null,
        sedol: data.sedol || null,
        cusip: data.cusip || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      updateDraft({ exchange_listings: [...draft.exchange_listings, newListing] })
      setAddingListing(false)
    }
  }, [draft, updateDraft, editingListingId])

  const handleDeleteListing = useCallback((id: number) => {
    if (!draft) return
    updateDraft({ exchange_listings: draft.exchange_listings.filter(e => e.id !== id) })
  }, [draft, updateDraft])

  const handleSaveReuters = useCallback((selected: { id: number; code: string; name: string }[]) => {
    if (!draft) return
    const newCodes: CompanyWireCode[] = selected.map(s => ({
      id: Date.now() + s.id,
      company_id: draft.id,
      wire_code_id: s.id,
      wire_code: { id: s.id, source: 'reuters', code_type: 'category', code: s.code, name: s.name }
    }))
    const existing = draft.wire_codes.filter(w => w.wire_code.source !== 'reuters' || !selected.find(s => s.id === w.wire_code_id))
    updateDraft({ wire_codes: [...existing, ...newCodes] })
    setAddingReuters(false)
  }, [draft, updateDraft])

  const handleSaveBloomberg = useCallback((selected: { id: number; code: string; name: string }[]) => {
    if (!draft) return
    const newCodes: CompanyWireCode[] = selected.map(s => ({
      id: Date.now() + s.id,
      company_id: draft.id,
      wire_code_id: s.id,
      wire_code: { id: s.id, source: 'bloomberg', code_type: 'category', code: s.code, name: s.name }
    }))
    const existing = draft.wire_codes.filter(w => w.wire_code.source !== 'bloomberg' || !selected.find(s => s.id === w.wire_code_id))
    updateDraft({ wire_codes: [...existing, ...newCodes] })
    setAddingBloomberg(false)
  }, [draft, updateDraft])

  const handleDeleteWireCode = useCallback((id: number) => {
    if (!draft) return
    updateDraft({ wire_codes: draft.wire_codes.filter(w => w.id !== id) })
  }, [draft, updateDraft])

  if (!draft) return null

  const reutersCodes = draft.wire_codes.filter(w => w.wire_code.source === 'reuters')
  const bloombergCodes = draft.wire_codes.filter(w => w.wire_code.source === 'bloomberg')

  return (
    <div className="tab-content">

      {/* Stock Exchange Listings */}
      <div className="section-header">
        <span className="section-header__title">Stock Exchange Listings</span>
        <div className="section-header__actions">
          <Button variant="outline" size="sm" onClick={() => { setAddingListing(true); setEditingListingId(null) }}>+ Add listing</Button>
          <Button variant="outline" size="sm">↓ Import from CSV</Button>
        </div>
      </div>

      {addingListing && (
        <div className="contact-card" style={{ marginBottom: 16 }}>
          <div className="label">Add new listing</div>
          <ListingForm initial={EMPTY_LISTING} onSave={handleSaveListing} onCancel={() => setAddingListing(false)} />
        </div>
      )}

      {draft.exchange_listings.length === 0 ? (
        <EmptyState label="Stock Listing" />
      ) : (
        <div className="data-table">
          <div className="data-table__header identifiers-listing-grid">
            <span>Code</span>
            <span>Description</span>
            <span>Ticker</span>
            <span>ISIN</span>
            <span>SEDOL</span>
            <span>CUSIP</span>
            <span />
          </div>
          {draft.exchange_listings.map(e => (
            <>
              <div key={e.id} className="data-table__row identifiers-listing-grid">
                <span>{e.exchange_id}</span>
                <span className="data-table__secondary">{e.exchange_name}</span>
                <span>{e.ticker_code}</span>
                <span>{e.isin ?? '–'}</span>
                <span>{e.sedol ?? '–'}</span>
                <span>{e.cusip ?? '–'}</span>
                <div className="data-table__row-actions">
                  <button className="data-table__delete" onClick={() => handleDeleteListing(e.id)}><TrashIcon /></button>
                  <button className="data-table__edit" onClick={() => { setEditingListingId(e.id); setAddingListing(false) }}>✎</button>
                </div>
              </div>
              {editingListingId === e.id && (
                <div className="data-table__inline-form">
                  <ListingForm
                    initial={{ exchange_id: e.exchange_id, exchange_name: e.exchange_name, ticker_code: e.ticker_code, isin: e.isin ?? '', sedol: e.sedol ?? '', cusip: e.cusip ?? '' }}
                    onSave={handleSaveListing}
                    onCancel={() => setEditingListingId(null)}
                  />
                </div>
              )}
            </>
          ))}
        </div>
      )}

      {/* Reuters Codes */}
      <div className="section-header" style={{ marginTop: 40 }}>
        <span className="section-header__title">Reuters Codes</span>
        <div className="section-header__actions">
          <Button variant="outline" size="sm" onClick={() => { setAddingReuters(true); setAddingBloomberg(false) }}>+ Add Reuters code</Button>
          <Button variant="outline" size="sm">↓ Import from CSV</Button>
        </div>
      </div>

      {addingReuters && (
        <CodeSearchPanel
          title="Add new Reuters code"
          masterList={MOCK_REUTERS_CODES}
          onSave={handleSaveReuters}
          onCancel={() => setAddingReuters(false)}
        />
      )}

      {reutersCodes.length === 0 ? (
        <EmptyState label="Reuters Code" />
      ) : (
        <div className="data-table">
          <div className="data-table__header identifiers-code-grid">
            <span>Code</span>
            <span>Description</span>
            <span />
          </div>
          {reutersCodes.map(w => (
            <div key={w.id} className="data-table__row identifiers-code-grid">
              <span>{w.wire_code.code}</span>
              <span className="data-table__secondary">{w.wire_code.name}</span>
              <button className="data-table__delete" onClick={() => handleDeleteWireCode(w.id)}><TrashIcon /></button>
            </div>
          ))}
        </div>
      )}

      {/* Bloomberg Codes */}
      <div className="section-header" style={{ marginTop: 40 }}>
        <span className="section-header__title">Bloomberg Codes</span>
        <div className="section-header__actions">
          <Button variant="outline" size="sm" onClick={() => { setAddingBloomberg(true); setAddingReuters(false) }}>+ Add Bloomberg code</Button>
          <Button variant="outline" size="sm">↓ Import from CSV</Button>
        </div>
      </div>

      {addingBloomberg && (
        <CodeSearchPanel
          title="Add new Bloomberg code"
          masterList={MOCK_BLOOMBERG_CODES}
          onSave={handleSaveBloomberg}
          onCancel={() => setAddingBloomberg(false)}
        />
      )}

      {bloombergCodes.length === 0 ? (
        <EmptyState label="Bloomberg Code" />
      ) : (
        <div className="data-table">
          <div className="data-table__header identifiers-code-grid">
            <span>Code</span>
            <span>Description</span>
            <span />
          </div>
          {bloombergCodes.map(w => (
            <div key={w.id} className="data-table__row identifiers-code-grid">
              <span>{w.wire_code.code}</span>
              <span className="data-table__secondary">{w.wire_code.name}</span>
              <button className="data-table__delete" onClick={() => handleDeleteWireCode(w.id)}><TrashIcon /></button>
            </div>
          ))}
        </div>
      )}

    </div>
  )
})

export default IdentifiersTab
