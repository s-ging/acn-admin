import { describe, it, expect } from 'vitest'
import {
  mapBloombergCode,
  mapCompanyDetail,
  mapCompanyExtraDetails,
  mapCompanyListItem,
  mapContact,
  mapSector,
  mapTicker,
  mergeCompanyDetail,
} from './map-company'
import { codeHash } from '../wire-codes'
import type {
  ApiCompanyDetail,
  ApiCompanyExtraDetails,
  ApiCompanyListItem,
} from './types'

// Every fixture below is a real response from development.acnnewswire.com,
// trimmed but not reshaped — the point of these tests is that the mappers
// survive what the server actually sends, including its "" -for-null habit and
// its two spellings of the same field.

/** `GET /api/Companies?Page=1&Size=1` — company 14. */
const LIST_ITEM: ApiCompanyListItem = {
  companyId: 14,
  companyNameEN: 'Umetal',
  companyNameCH: 'Umetal',
  companyNameCT: 'JCN Traditional Chinese',
  companyNameJP: 'Umetal',
  companyNameKO: 'JCN Korean1',
  logoFilename: null,
  topLogoFilename: null,
  boilerPlate: 'Umetal.net is the leading information website for steels.',
  extBoilerPlate: 'Umetal.net is the leading information website for steels.',
  reportFilename: null,
  reportFileDate: null,
  reportFileSize: null,
  username: '14',
  password: 'p12q34',
  url: 'www.umetal.net',
}

/** `GET /api/Companies/23` — IR Magazine, which has sectors and Bloomberg codes. */
const DETAIL: ApiCompanyDetail = {
  companyId: 23,
  companyName: 'IR Magazine',
  companyName2: 'IR Magazine',
  companyNameJP: 'IR Magazine',
  companyNameCH: 'IR Magazine ',
  companyNameCT: 'IR Magazine ',
  companyNameKO: '',
  ticker: '',
  url: 'www.thecrossbordergroup.com',
  boilerPlate: 'IR Magazine covers investor relations.',
  sectorId: 108,
  topLogoFilename: 'IRMagazine_Top.jpg',
  logoFilename: 'IRMagazine.jpg',
  username: '23',
  password: 'secret',
  allowAccess: true,
  blog: null,
  facebook: null,
  twitter: null,
  youTube: null,
  linkedIn: null,
  telegram: null,
  rss: [],
  bloomberg: [
    { compId: 23, id: 71, bloombergCode: 'ASIAX', name: 'Asia ex. Japan, Australia' },
    { compId: 23, id: 73, bloombergCode: 'ASIA', name: 'Asia, Pacific Rim' },
  ],
  sectors: [
    { compId: 23, id: 108, name: 'Daily Finance', description: 'Daily Finance' },
    { compId: 23, id: 92, name: 'Exchanges & Software', description: 'Investors/Exchanges' },
  ],
  tickers: [],
  contacts: [],
  page: 1,
  size: 20,
  sort1: '',
  ord1: 'ASC',
}

/** `GET /api/Companies/14/details` — note every unset field is "" not null. */
const EXTRA: ApiCompanyExtraDetails = {
  established: '',
  listed: '',
  employees: '',
  dunsNumber: '',
  otc: '',
  marketId: '1',
  urlJa: '',
  blog: null,
  facebook: null,
  twitter: null,
  linkedIn: null,
  youTube: null,
  telegram: null,
  addr1: '',
  addr2: '',
  addr3: '',
  addr4: '',
  telephone: '',
  facsimile: '',
  email: '',
  pos1Name: '',
  pos1Desc: 'CEO',
  pos2Name: '',
  pos2Desc: 'CEO',
}

describe('mapCompanyListItem', () => {
  it('maps the localised names onto the model’s script-based fields', () => {
    const company = mapCompanyListItem(LIST_ITEM)
    expect(company.id).toBe(14)
    expect(company.name_en).toBe('Umetal')
    expect(company.name_zh_hans).toBe('Umetal')
    expect(company.name_zh_hant).toBe('JCN Traditional Chinese')
    expect(company.name_ja).toBe('Umetal')
    expect(company.name_ko).toBe('JCN Korean1')
  })

  it('marks a company off the wire active rather than draft', () => {
    expect(mapCompanyListItem(LIST_ITEM).status).toBe('active')
  })

  it('carries the portal credentials and boilerplate', () => {
    const company = mapCompanyListItem(LIST_ITEM)
    expect(company.portal_username).toBe('14')
    expect(company.portal_password).toBe('p12q34')
    expect(company.about_html).toContain('leading information website')
  })

  it('leaves the extended-boilerplate flag off when it merely repeats the short one', () => {
    expect(mapCompanyListItem(LIST_ITEM).delivery_settings.show_extended_boilerplate).toBe(false)
  })

  it('turns the flag on when the extended boilerplate genuinely differs', () => {
    const company = mapCompanyListItem({ ...LIST_ITEM, extBoilerPlate: 'A much longer version.' })
    expect(company.delivery_settings.show_extended_boilerplate).toBe(true)
  })

  it('produces a complete record, so no field is undefined', () => {
    const company = mapCompanyListItem(LIST_ITEM)
    for (const [key, value] of Object.entries(company)) {
      expect(value, `${key} should be null, not undefined`).not.toBeUndefined()
    }
  })
})

describe('mapCompanyDetail', () => {
  it('resolves logo filenames to the two different image paths', () => {
    const company = mapCompanyDetail(DETAIL)
    expect(company.logo_article_url).toBe('https://www.acnnewswire.com/images/company/IRMagazine.jpg')
    expect(company.logo_top_url).toBe('https://www.acnnewswire.com/images/toppage/IRMagazine_Top.jpg')
  })

  it('collapses the server’s empty strings to null', () => {
    // companyNameKO is "" on this record — a blank, not a Korean name.
    expect(mapCompanyDetail(DETAIL).name_ko).toBeNull()
  })

  it('keeps every sector the wire returns, not just the first', () => {
    expect(mapCompanyDetail(DETAIL).sectors).toHaveLength(2)
  })

  it('carries allowAccess into the delivery settings', () => {
    expect(mapCompanyDetail(DETAIL).delivery_settings.allow_access).toBe(true)
    expect(mapCompanyDetail({ ...DETAIL, allowAccess: false }).delivery_settings.allow_access).toBe(false)
  })

  it('falls back to the sectorId column when the sectors list is empty', () => {
    const company = mapCompanyDetail({ ...DETAIL, sectors: [], sectorId: 108 })
    expect(company.sectors).toHaveLength(1)
    expect(company.sectors[0].sector_id).toBe(108)
    expect(company.sectors[0].sector_type).toBe('Financial')
  })

  it('has no sectors when neither the list nor the column has one', () => {
    expect(mapCompanyDetail({ ...DETAIL, sectors: [], sectorId: null }).sectors).toEqual([])
  })
})

describe('mapSector', () => {
  it('resolves sector_type off the master taxonomy rather than the wire’s description', () => {
    // The wire calls sector 92 "Investors/Exchanges"; the taxonomy says Financial.
    const sector = mapSector({ compId: 23, id: 92, name: 'Exchanges & Software', description: 'Investors/Exchanges' })
    expect(sector.sector_id).toBe(92)
    expect(sector.sector_type).toBe('Financial')
    expect(sector.sector_name).toBe('Exchanges & Software')
  })

  it('falls back to the wire’s own strings for an id the taxonomy doesn’t carry', () => {
    const sector = mapSector({ compId: 1, id: 999999, name: 'Something New', description: 'Uncategorised' })
    expect(sector.sector_type).toBe('Uncategorised')
    expect(sector.sector_name).toBe('Something New')
  })
})

describe('mapBloombergCode', () => {
  it('hashes the code the same way the Identifiers tab does, so a code can’t be added twice', () => {
    const row = mapBloombergCode({ compId: 23, id: 71, bloombergCode: 'ASIAX', name: 'Asia ex. Japan' })
    expect(row.wire_code_id).toBe(codeHash('ASIAX'))
    expect(row.wire_code.source).toBe('bloomberg')
    expect(row.wire_code.code).toBe('ASIAX')
  })

  it('takes code_type from the master list, which the API has no field for', () => {
    // GOV is in BLOOMBERG_CODES under "Agencies, Government".
    const row = mapBloombergCode({ compId: 1, id: 1, bloombergCode: 'GOV', name: null })
    expect(row.wire_code.code_type).toBe('Agencies, Government')
    expect(row.wire_code.name).toBe('Government News')
  })

  it('keeps the wire’s label for a code the master list doesn’t know', () => {
    const row = mapBloombergCode({ compId: 1, id: 1, bloombergCode: 'ZZZZ', name: 'Some New Desk' })
    expect(row.wire_code.code_type).toBe('')
    expect(row.wire_code.name).toBe('Some New Desk')
  })
})

describe('mapTicker', () => {
  it('maps an exchange listing and nulls the codes the wire never sends', () => {
    const listing = mapTicker({
      id: 485, compId: 100, exchangeId: 'XBKK',
      exchangeName: 'Stock Exchange of Thailand', tickerId: 'DTAC', isin: '',
    })
    expect(listing.exchange_id).toBe('XBKK')
    expect(listing.ticker_code).toBe('DTAC')
    // "" means unset, and the wire carries neither SEDOL nor CUSIP.
    expect(listing.isin).toBeNull()
    expect(listing.sedol).toBeNull()
    expect(listing.cusip).toBeNull()
  })
})

describe('mapContact', () => {
  it('maps the richer /CompContacts row', () => {
    const contact = mapContact({
      contId: 3641, compId: 3128,
      contactName: 'kazuyo.takeda@jcnnewswire.com',
      contactPhone: ' ', contactPosition: ' ',
      contactEmail: 'kazuyo.takeda@jcnnewswire.com',
      contactFax: '', contactDesc: '', format: 'HTML',
    }, 3128, 0)

    expect(contact.id).toBe(3641)
    expect(contact.email).toBe('kazuyo.takeda@jcnnewswire.com')
    // A single space is the wire's way of saying "no phone".
    expect(contact.phone).toBeNull()
    expect(contact.position).toBeNull()
    expect(contact.email_format).toBe('html')
  })

  it('maps the thinner embedded row, leaving the absent fields null', () => {
    const contact = mapContact({
      contId: 3648, contactName: 'a-hirao@ml.tanaka.co.jp',
      contactPhone: ' ', contactEmail: 'a-hirao@ml.tanaka.co.jp',
    }, 3128, 2)

    expect(contact.company_id).toBe(3128)
    expect(contact.position).toBeNull()
    expect(contact.fax).toBeNull()
    expect(contact.sort_order).toBe(2)
  })

  it('reads a TEXT format as the text email format', () => {
    const contact = mapContact(
      { contId: 1, contactName: 'a', contactPhone: null, contactEmail: null, format: 'TEXT' }, 1
    )
    expect(contact.email_format).toBe('text')
  })
})

describe('mapCompanyExtraDetails', () => {
  it('maps addr1..addr4 to street, district, city, country in order', () => {
    const patch = mapCompanyExtraDetails({
      ...EXTRA, addr1: '1-1 Marunouchi', addr2: 'Chiyoda-ku', addr3: 'Tokyo', addr4: 'Japan',
    })
    expect(patch.address_street).toBe('1-1 Marunouchi')
    expect(patch.address_district).toBe('Chiyoda-ku')
    expect(patch.address_city).toBe('Tokyo')
    expect(patch.address_country).toBe('Japan')
  })

  it('collapses the server’s blanks so an unset field doesn’t read as set', () => {
    const patch = mapCompanyExtraDetails(EXTRA)
    expect(patch.established).toBeNull()
    expect(patch.employees).toBeNull()
    expect(patch.key_person_1_name).toBeNull()
    // ...while a real value survives.
    expect(patch.market_id).toBe('1')
    expect(patch.key_person_1_title).toBe('CEO')
  })

  it('omits a social link it has no value for, so it can’t blank the main record’s', () => {
    expect('facebook' in mapCompanyExtraDetails(EXTRA)).toBe(false)
    expect(mapCompanyExtraDetails({ ...EXTRA, facebook: 'fb.com/x' }).facebook).toBe('fb.com/x')
  })
})

describe('mergeCompanyDetail', () => {
  it('takes the annual report from the list endpoint, which alone returns it', () => {
    const merged = mergeCompanyDetail(mapCompanyDetail(DETAIL), {
      listItem: { ...LIST_ITEM, companyId: 23, reportFilename: 'ar2025.pdf', reportFileSize: '2.1MB' },
    })
    expect(merged.annual_report_name).toBe('ar2025.pdf')
    expect(merged.annual_report_size).toBe('2.1MB')
    expect(merged.annual_report_url).toContain('ar2025.pdf')
  })

  it('does not let a blank from one endpoint erase a value from another', () => {
    const merged = mergeCompanyDetail(mapCompanyDetail(DETAIL), {
      // The list row for this company has no logo and no boilerplate...
      listItem: { ...LIST_ITEM, companyId: 23, logoFilename: null, boilerPlate: null },
    })
    // ...but the detail record does, and it survives.
    expect(merged.logo_article_url).toContain('IRMagazine.jpg')
    expect(merged.about_html).toContain('investor relations')
  })

  it('replaces the embedded contacts with the richer /CompContacts rows', () => {
    const merged = mergeCompanyDetail(mapCompanyDetail(DETAIL), {
      contacts: [{
        contId: 1, contactName: 'Jane Roe', contactPhone: '+81 3 0000 0000',
        contactEmail: 'jane@example.com', contactPosition: 'Head of IR', format: 'HTML',
      }],
    })
    expect(merged.contacts).toHaveLength(1)
    expect(merged.contacts[0].position).toBe('Head of IR')
  })

  it('applies the /details patch over the main record', () => {
    const merged = mergeCompanyDetail(mapCompanyDetail(DETAIL), {
      extraDetails: { ...EXTRA, employees: '120', addr3: 'London' },
    })
    expect(merged.employees).toBe('120')
    expect(merged.address_city).toBe('London')
  })
})
