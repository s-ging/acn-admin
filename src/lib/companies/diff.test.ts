import { describe, it, expect } from 'vitest'
import { applyChanges, diffCompany, FIELDS, findConflicts, IGNORED_FIELDS } from './diff'
import { blankCompany } from './blank'
import type { CompanyContact, CompanyFull, CompanySector, ExchangeListing } from '../../types/company.types'

/** A company as it comes off the API: no created_at. */
function base(over: Partial<CompanyFull> = {}): CompanyFull {
  return { ...blankCompany(82, 'Mitsubishi Heavy Industries'), created_at: '', updated_at: '', ...over }
}

const sector = (sector_name: string, sector_id = 0): CompanySector =>
  ({ id: sector_id, company_id: 82, sector_id, sector_type: '', sector_name })

const listing = (exchange_id: string, ticker_code: string): ExchangeListing => ({
  id: 0, company_id: 82, exchange_id, exchange_name: '', ticker_code,
  isin: null, sedol: null, cusip: null, created_at: '', updated_at: '',
})

const contact = (id: number, name: string): CompanyContact => ({
  id, company_id: 82, name, position: null, email: null, phone: null, fax: null,
  contact_type: 'freetext', email_format: 'html', notes: null, sort_order: 0, created_at: '', updated_at: '',
})

describe('diffCompany', () => {
  it('maps a field to its wire name, and sends a cleared field as ""', () => {
    const before = base({ address_city: 'Tokyo', telephone: '03-1234' })
    const changes = diffCompany(before, { ...before, address_city: 'Yokohama', telephone: null })
    expect(changes.map(c => [c.key, c.sync, c.ops])).toEqual([
      ['field:telephone', 'api', [{ kind: 'details', key: 'telephone', value: '' }]],
      ['field:address_city', 'api', [{ kind: 'details', key: 'addr3', value: 'Yokohama' }]],
    ])
  })

  it('treats "" and null as the same value', () => {
    const before = base({ otc: null })
    expect(diffCompany(before, { ...before, otc: '' })).toEqual([])
  })

  it('marks changes with no endpoint as local, with no requests', () => {
    const before = base()
    const changes = diffCompany(before, { ...before, status: 'inactive', contacts: [contact(1, 'Kengo')] })
    expect(changes.map(c => [c.key, c.sync, c.ops.length])).toEqual([
      ['field:status', 'local', 0],
      ['contacts:1', 'local', 0],
    ])
  })

  it('sends a logo as its filename, and keeps an upload preview local', () => {
    const before = base({ logo_article_url: 'https://www.acnnewswire.com/images/company/old.jpg' })
    const [renamed] = diffCompany(before, { ...before, logo_article_url: 'https://www.acnnewswire.com/images/company/new.jpg' })
    expect(renamed.ops).toEqual([{ kind: 'basicInfo', key: 'logoFilename', value: 'new.jpg' }])
    const [uploaded] = diffCompany(before, { ...before, logo_article_url: 'data:image/png;base64,AAAA' })
    expect(uploaded.sync).toBe('local')
  })

  it('keys sectors by name and sends the primary flag when it moves', () => {
    const before = base({ sectors: [sector('Aerospace & Defence', 211)] })
    // A sector picked in the editor carries a lib/sectors.ts id, not the wire's.
    const after = { ...before, sectors: [sector('Engineering', 999), sector('Aerospace & Defence', 5)] }
    expect(diffCompany(before, after).flatMap(c => c.ops)).toEqual([
      { kind: 'industry:put', name: 'Engineering', isPrimary: true },
      { kind: 'industry:put', name: 'Aerospace & Defence', isPrimary: false },
    ])
  })

  it('keys listings by (mic, ticker)', () => {
    const before = base({ exchange_listings: [listing('XTKS', '7011'), listing('OOTC', 'MHVIY')] })
    const after = { ...before, exchange_listings: [listing('XTKS', '7011'), listing('XFRA', 'MIH')] }
    expect(diffCompany(before, after).flatMap(c => c.ops)).toEqual([
      { kind: 'listing:create', mic: 'XFRA', ticker: 'MIH', isPrimary: false, sortOrder: 1 },
      { kind: 'listing:delete', mic: 'OOTC', ticker: 'MHVIY' },
    ])
  })

  it('looks at every field of a company — a new field must be listed or ignored', () => {
    const covered = new Set([
      ...FIELDS.map(f => f.path.split('.')[0]),
      ...IGNORED_FIELDS,
      'contacts', 'sectors', 'exchange_listings', 'wire_codes', 'rss_feeds', 'relations', 'wire_services',
    ])
    expect(Object.keys(blankCompany(1)).filter(k => !covered.has(k))).toEqual([])
  })
})

describe('applyChanges', () => {
  it('turns the base into the draft', () => {
    const before = base({
      name_en: 'MHI',
      sectors: [sector('Engineering')],
      exchange_listings: [listing('XTKS', '7011')],
      contacts: [contact(1, 'A'), contact(2, 'B')],
    })
    const after: CompanyFull = {
      ...before,
      name_en: 'Mitsubishi Heavy Industries',
      languages: ['JA'],
      delivery_settings: { ...before.delivery_settings, show_alerts: true },
      sectors: [sector('Aerospace & Defence'), sector('Engineering')],
      exchange_listings: [listing('OOTC', 'MHVIY'), listing('XTKS', '7011')],
      contacts: [{ ...contact(2, 'B'), email: 'b@mhi.co.jp' }],
    }
    expect(applyChanges(before, diffCompany(before, after))).toEqual(after)
  })

  it('rebases a draft onto a newer API version, keeping both sides’ changes', () => {
    const started = base({ telephone: '1', facsimile: '1' })
    const draft = { ...started, telephone: '2' }
    const fresh = { ...started, facsimile: '9' }
    expect(applyChanges(fresh, diffCompany(started, draft))).toMatchObject({ telephone: '2', facsimile: '9' })
  })
})

describe('findConflicts', () => {
  it('flags only what both sides changed, differently', () => {
    const started = base({ telephone: '1', facsimile: '1', otc: 'A' })
    const mine = diffCompany(started, { ...started, telephone: '2', otc: 'B' })
    const theirs = diffCompany(started, { ...started, telephone: '3', facsimile: '9', otc: 'B' })
    expect(findConflicts(mine, theirs)).toEqual([
      { key: 'field:telephone', label: 'Telephone', mine: '2', theirs: '3' },
    ])
  })
})
