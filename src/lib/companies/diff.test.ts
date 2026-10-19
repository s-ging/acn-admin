import { describe, it, expect } from 'vitest'
import { applyChanges, diffCompany, FIELDS, findConflicts, IGNORED_FIELDS } from './diff'
import { blankCompany } from './blank'
import type { CompanyContact, CompanyFull, CompanyIndustry, CompanySector, ExchangeListing } from '../../types/company.types'

/** A company as it comes off the API: no created_at. */
function base(over: Partial<CompanyFull> = {}): CompanyFull {
  return { ...blankCompany(82, 'Mitsubishi Heavy Industries'), created_at: '', updated_at: '', ...over }
}

const sector = (sector_name: string, sector_id = 0): CompanySector =>
  ({ id: sector_id, company_id: 82, sector_id, sector_type: '', sector_name })

const industry = (industry_id: number): CompanyIndustry => ({ industry_id, industry_name: `Industry ${industry_id}` })

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

  it('sends industries by wire id with the primary flag; keeps sectors local', () => {
    const before = base({ industries: [industry(2)] })
    const after = { ...before, industries: [industry(25), industry(2)], sectors: [sector('Engineering', 208)] }
    const changes = diffCompany(before, after)
    expect(changes.flatMap(c => c.ops)).toEqual([
      { kind: 'industry:put', id: 25, isPrimary: true },
      { kind: 'industry:put', id: 2, isPrimary: false },
    ])
    expect(changes.find(c => c.key.startsWith('sectors:'))?.sync).toBe('local')
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
      'contacts', 'sectors', 'industries', 'exchange_listings', 'wire_codes', 'rss_feeds', 'relations', 'wire_services',
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
