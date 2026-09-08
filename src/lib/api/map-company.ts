// src/lib/api/map-company.ts
// Wire company → CompanyFull.
//
// The app model is the one that matters here: this fills fields the API has a
// value for and leaves everything else at the blank-record default, so a
// mapped company is always a complete, valid CompanyFull. `blankCompany` is the
// base rather than a literal so a field added to the model later shows up here
// as a blank instead of as `undefined`.
//
// What the API has no value for, and is therefore left blank:
//
//   status                — no equivalent field. See STATUS_FOR_API_RECORD.
//   created_at/updated_at — the API exposes no audit timestamps at all.
//   created_by/updated_by — same.
//   instagram             — the API carries blog/facebook/twitter/youTube/
//                           linkedIn/telegram, but no Instagram.
//   exchange_listed_date  — `listed` from /details is a free-text year, and it
//                           lands in `exchange_listed_date` as-is.
//   relations             — no company-relations endpoint exists.
//   wire_services         — no endpoint.
//   rss_feeds             — /api/Companies/{id} has an `rss` array, but it was
//                           empty for every company sampled, so the row shape
//                           is unknown and nothing can be mapped from it.
//   sedol / cusip         — the ticker rows carry only `isin`.
//   delivery_settings     — only `allow_access` has a source (`allowAccess`).
//
// Writing is not part of this: every operation in the spec is a GET, so there
// is no reverse mapper. Edits stay in localStorage.

import { blankCompany } from '../companies/blank'
import { SECTORS } from '../sectors'
import { BLOOMBERG_CODES } from '../bloomberg-codes'
import { codeHash } from '../wire-codes'
import { annualReportUrl, companyLogoUrl, companyTopLogoUrl } from './media'
import type {
  ApiBloombergCode,
  ApiCompanyContact,
  ApiCompanyDetail,
  ApiCompanyExtraDetails,
  ApiCompanyListItem,
  ApiCompanySector,
  ApiTicker,
} from './types'
import type {
  CompanyContact,
  CompanyFull,
  CompanySector,
  CompanyWireCode,
  ExchangeListing,
} from '../../types/company.types'

/**
 * A company that came off the wire is a live company on the newswire, not a
 * draft someone started. `blankCompany` defaults to 'draft' because it models
 * an empty form; an API record is the opposite case.
 */
const STATUS_FOR_API_RECORD = 'active' as const

/**
 * The API sends "" as freely as null. Everything downstream tests these fields
 * for null, so an empty string has to collapse to null or "no value" reads as a
 * value — an empty Established field would render as a set-but-blank row.
 */
function str(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** The API has no audit timestamps. Left empty rather than stamped with the
 *  fetch time, which would show every company as modified today. */
const NO_TIMESTAMP = ''

// ── Sub-records ─────────────────────────────────────────────────────────────

/**
 * A sector tag. The API's `id` indexes the same taxonomy as lib/sectors.ts, so
 * `sector_type` resolves off the master list; the API's own `name` /
 * `description` are the fallback for an id the list doesn't carry.
 *
 * Note the API can return several sectors for one company. They are all kept,
 * even though the editor and `resolveSector` only read `sectors[0]` — dropping
 * them here would lose data the wire actually holds.
 */
export function mapSector(api: ApiCompanySector): CompanySector {
  const master = SECTORS.find(s => s.id === api.id)
  return {
    id: api.id,
    company_id: api.compId,
    sector_id: api.id,
    sector_type: master?.sector_type ?? str(api.description) ?? '',
    sector_name: master?.sector_name ?? str(api.name) ?? '',
  }
}

export function mapTicker(api: ApiTicker): ExchangeListing {
  return {
    id: api.id,
    company_id: api.compId,
    exchange_id: str(api.exchangeId) ?? '',
    exchange_name: str(api.exchangeName) ?? '',
    ticker_code: str(api.tickerId) ?? '',
    isin: str(api.isin),
    // The wire carries neither of these.
    sedol: null,
    cusip: null,
    created_at: NO_TIMESTAMP,
    updated_at: NO_TIMESTAMP,
  }
}

/**
 * A Bloomberg code row.
 *
 * `wire_code_id` goes through `codeHash` — the same hash the Identifiers tab
 * uses — so a code added by hand and the same code arriving from the API get
 * one id and can't end up on the record twice. The master list supplies
 * `code_type`, which the API has no field for.
 */
export function mapBloombergCode(api: ApiBloombergCode): CompanyWireCode {
  const code = str(api.bloombergCode) ?? ''
  const master = BLOOMBERG_CODES.find(c => c.code === code)
  const codeId = codeHash(code)

  return {
    id: codeId,
    company_id: api.compId,
    wire_code_id: codeId,
    wire_code: {
      id: codeId,
      source: 'bloomberg',
      code_type: master?.category ?? '',
      code,
      name: master?.description ?? str(api.name) ?? '',
    },
  }
}

/**
 * A contact.
 *
 * Accepts rows from either source: the copy embedded in `/api/Companies/{id}`
 * has only name, phone and email, while `/api/CompContacts` adds position, fax,
 * description and format. Fields the given row lacks come out null.
 *
 * `contact_type` has no source — the API's `format` describes the *email* body
 * ("HTML"), which is `email_format`, a different field. It keeps the model
 * default of 'freetext'.
 */
export function mapContact(api: ApiCompanyContact, companyId: number, index = 0): CompanyContact {
  return {
    id: api.contId,
    company_id: api.compId ?? companyId,
    name: str(api.contactName) ?? '',
    position: str(api.contactPosition),
    email: str(api.contactEmail),
    phone: str(api.contactPhone),
    fax: str(api.contactFax),
    contact_type: 'freetext',
    email_format: str(api.format)?.toUpperCase() === 'TEXT' ? 'text' : 'html',
    notes: str(api.contactDesc),
    sort_order: index,
    created_at: NO_TIMESTAMP,
    updated_at: NO_TIMESTAMP,
  }
}

// ── Whole companies ─────────────────────────────────────────────────────────

/**
 * A company from `GET /api/Companies`.
 *
 * This is the list shape, which is a genuinely different projection from the
 * detail shape rather than a subset of it: it alone carries `extBoilerPlate`
 * and the three annual-report fields, and it has no sectors, tickers, contacts
 * or social links. Sub-lists come out empty here; `mergeCompanyDetail` fills
 * them in once the detail endpoints have been called.
 */
export function mapCompanyListItem(api: ApiCompanyListItem): CompanyFull {
  const base = blankCompany(api.companyId, str(api.companyNameEN) ?? '')

  return {
    ...base,
    status: STATUS_FOR_API_RECORD,
    name_en: str(api.companyNameEN) ?? '',
    name_zh_hans: str(api.companyNameCH),
    name_zh_hant: str(api.companyNameCT),
    name_ja: str(api.companyNameJP),
    name_ko: str(api.companyNameKO),
    logo_article_url: companyLogoUrl(api.logoFilename),
    logo_top_url: companyTopLogoUrl(api.topLogoFilename),
    url: str(api.url),
    about_html: str(api.boilerPlate),
    portal_username: str(api.username),
    portal_password: str(api.password),
    annual_report_url: annualReportUrl(api.reportFilename),
    annual_report_name: str(api.reportFilename),
    annual_report_date: str(api.reportFileDate),
    annual_report_size: str(api.reportFileSize),
    // `extBoilerPlate` is the long-form boilerplate. The model has one
    // `about_html`, so the extended copy only tells us the flag should be on
    // when it actually differs from the short one.
    delivery_settings: {
      ...base.delivery_settings,
      show_extended_boilerplate:
        !!str(api.extBoilerPlate) && str(api.extBoilerPlate) !== str(api.boilerPlate),
    },
    created_at: NO_TIMESTAMP,
    updated_at: NO_TIMESTAMP,
  }
}

/**
 * A company from `GET /api/Companies/{id}`.
 *
 * Named for what it is: this shape has the sub-lists and the social links but
 * lacks the annual-report and extended-boilerplate fields that only the list
 * endpoint returns. `mergeCompanyDetail` is what combines the two.
 */
export function mapCompanyDetail(api: ApiCompanyDetail): CompanyFull {
  const name = str(api.companyName) ?? str(api.companyName2) ?? ''
  const base = blankCompany(api.companyId, name)

  return {
    ...base,
    status: STATUS_FOR_API_RECORD,
    name_en: name,
    name_zh_hans: str(api.companyNameCH),
    name_zh_hant: str(api.companyNameCT),
    name_ja: str(api.companyNameJP),
    name_ko: str(api.companyNameKO),
    logo_article_url: companyLogoUrl(api.logoFilename),
    logo_top_url: companyTopLogoUrl(api.topLogoFilename),
    url: str(api.url),
    about_html: str(api.boilerPlate),
    portal_username: str(api.username),
    portal_password: str(api.password),
    blog: str(api.blog),
    facebook: str(api.facebook),
    twitter: str(api.twitter),
    youtube: str(api.youTube),
    linkedin: str(api.linkedIn),
    telegram: str(api.telegram),

    // `sectorId` is the company's own sector column. It is the authority when
    // the `sectors` list is empty, which is the common case on the dev host.
    sectors: api.sectors.length
      ? api.sectors.map(mapSector)
      : sectorFromId(api.companyId, api.sectorId),

    exchange_listings: api.tickers.map(mapTicker),
    wire_codes: api.bloomberg.map(mapBloombergCode),
    contacts: api.contacts.map((c, i) => mapContact(c, api.companyId, i)),

    delivery_settings: {
      ...base.delivery_settings,
      allow_access: api.allowAccess,
    },

    created_at: NO_TIMESTAMP,
    updated_at: NO_TIMESTAMP,
  }
}

/** The single-sector fallback, built from the company's `sectorId` column. */
function sectorFromId(companyId: number, sectorId: number | null): CompanySector[] {
  if (!sectorId) return []
  const master = SECTORS.find(s => s.id === sectorId)
  return [
    {
      id: sectorId,
      company_id: companyId,
      sector_id: sectorId,
      sector_type: master?.sector_type ?? '',
      sector_name: master?.sector_name ?? '',
    },
  ]
}

/** `GET /api/Companies/{id}/details` → the profile fields, as a patch. */
export function mapCompanyExtraDetails(api: ApiCompanyExtraDetails): Partial<CompanyFull> {
  const patch: Partial<CompanyFull> = {
    established: str(api.established),
    exchange_listed_date: str(api.listed),
    employees: str(api.employees),
    duns_number: str(api.dunsNumber),
    otc: str(api.otc),
    market_id: str(api.marketId),
    url_ja: str(api.urlJa),
    // addr1..addr4 are street, district, city, country.
    address_street: str(api.addr1),
    address_district: str(api.addr2),
    address_city: str(api.addr3),
    address_country: str(api.addr4),
    telephone: str(api.telephone),
    facsimile: str(api.facsimile),
    company_email: str(api.email),
    key_person_1_name: str(api.pos1Name),
    key_person_1_title: str(api.pos1Desc),
    key_person_2_name: str(api.pos2Name),
    key_person_2_title: str(api.pos2Desc),
  }

  // The social links appear on both endpoints. Only overwrite from here when
  // this response actually has a value, so a link present on the main record
  // isn't blanked by an empty copy on /details.
  const social = {
    blog: str(api.blog),
    facebook: str(api.facebook),
    twitter: str(api.twitter),
    youtube: str(api.youTube),
    linkedin: str(api.linkedIn),
    telegram: str(api.telegram),
  }
  for (const [key, value] of Object.entries(social)) {
    if (value !== null) (patch as Record<string, unknown>)[key] = value
  }

  return patch
}

/**
 * The one complete company, assembled from every endpoint that knows something
 * about it.
 *
 * Later arguments win, but only where they carry a value — the three sources
 * overlap and each is authoritative for a different slice, so a blank from one
 * must never erase a value from another. `contacts` from `/api/CompContacts`
 * replaces the embedded copy outright because it is the same rows with more
 * fields, not extra rows.
 */
export function mergeCompanyDetail(
  detail: CompanyFull,
  parts: {
    listItem?: ApiCompanyListItem | null
    extraDetails?: ApiCompanyExtraDetails | null
    contacts?: ApiCompanyContact[] | null
  } = {}
): CompanyFull {
  let merged = detail

  if (parts.listItem) {
    const fromList = mapCompanyListItem(parts.listItem)
    merged = {
      ...merged,
      // Only the list endpoint has these.
      annual_report_url: fromList.annual_report_url,
      annual_report_name: fromList.annual_report_name,
      annual_report_date: fromList.annual_report_date,
      annual_report_size: fromList.annual_report_size,
      delivery_settings: {
        ...merged.delivery_settings,
        show_extended_boilerplate: fromList.delivery_settings.show_extended_boilerplate,
      },
      name_en: merged.name_en || fromList.name_en,
      about_html: merged.about_html ?? fromList.about_html,
      logo_article_url: merged.logo_article_url ?? fromList.logo_article_url,
      logo_top_url: merged.logo_top_url ?? fromList.logo_top_url,
    }
  }

  if (parts.extraDetails) {
    merged = { ...merged, ...mapCompanyExtraDetails(parts.extraDetails) }
  }

  if (parts.contacts?.length) {
    merged = {
      ...merged,
      contacts: parts.contacts.map((c, i) => mapContact(c, detail.id, i)),
    }
  }

  return merged
}
