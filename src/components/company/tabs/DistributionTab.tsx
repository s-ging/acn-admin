import { useState, useCallback } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { TrashIcon } from '../../ui/TrashIcon'
import type { WireService, RSSFeed, DeliverySettings } from '../../../types/company.types'

const MOCK_WIRE_SEARCH: WireService[] = [
  { id: 101, company_id: 0, name: 'Tim McManan Smith', email: 'tim@energystmedia.com', country: 'UK' },
  { id: 102, company_id: 0, name: 'Ray Pavri', email: 'news@wattelectricalnews.com', country: 'Australia' },
  { id: 103, company_id: 0, name: 'Brad Reddersen', email: 'brad@scaredcrow.tv', country: 'Philippines' },
  { id: 104, company_id: 0, name: 'Amir Garanic', email: 'garanovic@offshore-engineer.com', country: 'USA' },
]

const MOCK_SECTORS = [
  'Aerospace & Defense', 'Engineering', 'Marine & Offshore',
  'Technology', 'Finance', 'Energy', 'Healthcare'
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`toggle ${checked ? 'toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span className="toggle__thumb" />
    </button>
  )
}

interface RSSFormState {
  feed_name: string
  url: string
  status: 'active' | 'paused'
  sector_name: string
}

function RSSForm({ initial, onSave, onCancel }: {
  initial: RSSFormState
  onSave: (data: RSSFormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(initial)
  const set = (field: keyof RSSFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="contact-form">
      <div className="contact-form__row contact-form__row--3">
        <Field label="Feed name" value={form.feed_name} placeholder="e.g. ACN Newswire - Asia" onChange={e => set('feed_name', e.target.value)} />
        <Field label="URL" value={form.url} placeholder="e.g. https://www.acnnewswire.com/rss/sector/211" onChange={e => set('url', e.target.value)} />
        <div className="field">
          <label className="field__label">Status</label>
          <select className="field__select" value={form.status} onChange={e => set('status', e.target.value as 'active' | 'paused')}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      </div>
      <div className="contact-form__row contact-form__row--4">
        <div className="field">
          <label className="field__label">Sector</label>
          <select className="field__select" value={form.sector_name} onChange={e => set('sector_name', e.target.value)}>
            <option value="">e.g. Aerospace &amp; Defense</option>
            {MOCK_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="contact-form__divider" />
      <div className="contact-form__actions">
        <Button variant="danger" size="sm" onClick={onCancel}>✕ Cancel entry</Button>
        <Button variant="outline" size="sm" onClick={() => onSave(form)}>Save changes</Button>
      </div>
    </div>
  )
}

export default function DistributionTab() {
  const draft = useCompanyStore(s => s.draft)
  const updateDraft = useCompanyStore(s => s.updateDraft)

  const [addingWire, setAddingWire] = useState(false)
  const [wireSearch, setWireSearch] = useState('')
  const [selectedWires, setSelectedWires] = useState<Set<number>>(new Set())

  const [addingFeed, setAddingFeed] = useState(false)
  const [editingFeedId, setEditingFeedId] = useState<number | null>(null)

  const EMPTY_RSS: RSSFormState = { feed_name: '', url: '', status: 'active', sector_name: '' }

  const filteredWire = MOCK_WIRE_SEARCH.filter(w => {
    const q = wireSearch.toLowerCase()
    return w.name.toLowerCase().includes(q) || w.email.toLowerCase().includes(q) || w.country.toLowerCase().includes(q)
  })

  const toggleWireSelect = useCallback((id: number) => {
    setSelectedWires(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleSaveWires = useCallback(() => {
    if (!draft) return
    const toAdd = MOCK_WIRE_SEARCH.filter(w => selectedWires.has(w.id)).map(w => ({ ...w, company_id: draft.id }))
    updateDraft({ wire_services: [...draft.wire_services, ...toAdd] })
    setAddingWire(false)
    setWireSearch('')
    setSelectedWires(new Set())
  }, [draft, updateDraft, selectedWires])

  const handleDeleteWire = useCallback((id: number) => {
    if (!draft) return
    updateDraft({ wire_services: draft.wire_services.filter(w => w.id !== id) })
  }, [draft, updateDraft])

  const handleSaveFeed = useCallback((data: RSSFormState) => {
    if (!draft) return
    if (editingFeedId !== null) {
      const updated = draft.rss_feeds.map(f =>
        f.id === editingFeedId ? { ...f, ...data, sector_name: data.sector_name || null } : f
      )
      updateDraft({ rss_feeds: updated })
      setEditingFeedId(null)
    } else {
      const newFeed: RSSFeed = {
        id: Date.now(),
        company_id: draft.id,
        feed_name: data.feed_name,
        url: data.url,
        status: data.status,
        sector_id: null,
        sector_name: data.sector_name || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      updateDraft({ rss_feeds: [...draft.rss_feeds, newFeed] })
      setAddingFeed(false)
    }
  }, [draft, updateDraft, editingFeedId])

  const handleDeleteFeed = useCallback((id: number) => {
    if (!draft) return
    updateDraft({ rss_feeds: draft.rss_feeds.filter(f => f.id !== id) })
  }, [draft, updateDraft])

  const handleDelivery = useCallback((field: keyof DeliverySettings, value: boolean | string) => {
    if (!draft) return
    updateDraft({ delivery_settings: { ...draft.delivery_settings, [field]: value } })
  }, [draft, updateDraft])

  if (!draft) return null

  const ds = draft.delivery_settings

  return (
    <div className="tab-content">

      {/* Wire Services */}
      <div className="section-header">
        <span className="section-header__title">Wire Services</span>
        <div className="section-header__actions">
          <Button variant="outline" size="sm" onClick={() => { setAddingWire(true) }}>+ Add wire service</Button>
          <Button variant="outline" size="sm">↓ Import from CSV</Button>
        </div>
      </div>

      {addingWire && (
        <div className="contact-card" style={{ marginBottom: 16 }}>
          <div className="contact-card__new-label">Add new wire service</div>
          <div className="wire-search">
            <div className="wire-search__input-row">
              <span className="wire-search__icon">○</span>
              <input
                className="wire-search__input"
                placeholder="Search by name, email, or country"
                value={wireSearch}
                onChange={e => setWireSearch(e.target.value)}
              />
            </div>
            <div className="wire-search__results">
              {filteredWire.map(w => (
                <div key={w.id} className="wire-search__row">
                  <div className="wire-search__info">
                    <span className="wire-search__name">{w.name}</span>
                    <span className="wire-search__meta">{w.email} • {w.country}</span>
                  </div>
                  <button
                    className={`wire-search__add ${selectedWires.has(w.id) ? 'wire-search__add--selected' : ''}`}
                    onClick={() => toggleWireSelect(w.id)}
                  >
                    {selectedWires.has(w.id) ? '✓' : '+'}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="contact-form__divider" />
          <div className="contact-form__actions" style={{ padding: '12px 16px' }}>
            <Button variant="danger" size="sm" onClick={() => { setAddingWire(false); setWireSearch(''); setSelectedWires(new Set()) }}>✕ Cancel entry</Button>
            <Button variant="outline" size="sm" onClick={handleSaveWires}>Save changes</Button>
          </div>
        </div>
      )}

      <div className="data-table">
        <div className="data-table__header">
          <span>Name</span>
          <span>Email</span>
          <span>Country</span>
          <span />
        </div>
        {draft.wire_services.map(w => (
          <div key={w.id} className="data-table__row">
            <span>{w.name}</span>
            <span className="data-table__secondary">{w.email}</span>
            <span className="data-table__secondary">{w.country}</span>
            <button className="data-table__delete" onClick={() => handleDeleteWire(w.id)}><TrashIcon /></button>
          </div>
        ))}
      </div>

      {/* RSS Feeds */}
      <div className="section-header" style={{ marginTop: 40 }}>
        <span className="section-header__title">RSS Feeds</span>
        <div className="section-header__actions">
          <Button variant="outline" size="sm" onClick={() => { setAddingFeed(true); setEditingFeedId(null) }}>+ Add RSS Feed</Button>
          <Button variant="outline" size="sm">↓ Import from CSV</Button>
        </div>
      </div>

      {addingFeed && (
        <div className="contact-card" style={{ marginBottom: 16 }}>
          <div className="contact-card__new-label">Add new feed</div>
          <RSSForm initial={EMPTY_RSS} onSave={handleSaveFeed} onCancel={() => setAddingFeed(false)} />
        </div>
      )}

      <div className="data-table">
        <div className="data-table__header">
          <span>Feed name</span>
          <span>URL</span>
          <span>Status</span>
          <span />
        </div>
        {draft.rss_feeds.map(f => (
          <>
            <div key={f.id} className="data-table__row">
              <div>
                <div>{f.feed_name}</div>
                {f.sector_name && <div className="data-table__sub">Sector: {f.sector_name}</div>}
              </div>
              <span className="data-table__secondary">{f.url}</span>
              <span className="data-table__status">
                <span className={`status-dot status-dot--${f.status}`} />
                {f.status}
              </span>
              <div className="data-table__row-actions">
                <button className="data-table__delete" onClick={() => handleDeleteFeed(f.id)}><TrashIcon /></button>
                <button className="data-table__edit" onClick={() => { setEditingFeedId(f.id); setAddingFeed(false) }}>✎</button>
              </div>
            </div>
            {editingFeedId === f.id && (
              <div className="data-table__inline-form">
                <RSSForm
                  initial={{ feed_name: f.feed_name, url: f.url, status: f.status, sector_name: f.sector_name ?? '' }}
                  onSave={handleSaveFeed}
                  onCancel={() => setEditingFeedId(null)}
                />
              </div>
            )}
          </>
        ))}
      </div>

      {/* Delivery Settings */}
      <div className="section-header" style={{ marginTop: 40 }}>
        <span className="section-header__title">Delivery Settings</span>
      </div>

      <div className="delivery-grid">
        <div className="delivery-row">
          <span className="delivery-row__label">Allow Access</span>
          <Toggle checked={ds.allow_access} onChange={v => handleDelivery('allow_access', v)} />
        </div>
        <div className="delivery-row">
          <span className="delivery-row__label">Show Extended Boilerplate</span>
          <Toggle checked={ds.show_extended_boilerplate} onChange={v => handleDelivery('show_extended_boilerplate', v)} />
        </div>
        <div className="delivery-row">
          <span className="delivery-row__label">Show Photos</span>
          <Toggle checked={ds.show_photos} onChange={v => handleDelivery('show_photos', v)} />
        </div>
        <div className="delivery-row">
          <span className="delivery-row__label">Show Archives</span>
          <Toggle checked={ds.show_archives} onChange={v => handleDelivery('show_archives', v)} />
        </div>
        <div className="delivery-row">
          <span className="delivery-row__label">Show Banner</span>
          <Toggle checked={ds.show_banner} onChange={v => handleDelivery('show_banner', v)} />
        </div>
        <div className="delivery-row">
          <span className="delivery-row__label">Show Alerts</span>
          <Toggle checked={ds.show_alerts} onChange={v => handleDelivery('show_alerts', v)} />
        </div>
        <div className="delivery-row">
          <span className="delivery-row__label">Company Will Mail</span>
          <Toggle checked={ds.company_will_mail} onChange={v => handleDelivery('company_will_mail', v)} />
        </div>
        <div className="delivery-row">
          <span className="delivery-row__label">Delivery Method</span>
          <select className="field__select" style={{ width: 120 }} value={ds.delivery_method} onChange={e => handleDelivery('delivery_method', e.target.value)}>
            <option value="express">Express</option>
            <option value="standard">Standard</option>
            <option value="digest">Digest</option>
          </select>
        </div>
      </div>

    </div>
  )
}
