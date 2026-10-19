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
//   rss_feeds             — mapped from /full's `rss` as of the /full cutover.
//                           The row shape was an open question while every
//                           company sampled came back with an empty array;
//                           company 574 populates it as
//                           `{ compId, id, rssName }`. Only the NAME is on the
//                           wire — no url, sector or status — so those stay at
//                           their blank-record defaults. See mapRssFeed.
//   sedol / cusip         — the ticker rows carry only `isin`.
//   delivery_settings     — only `allow_access` has a source (`allowAccess`).
//
// The reverse mapping — CompanyFull back to the wire's write DTOs — is in
// ./write.ts.

import { industryName } from '../industries'
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
  ApiCompanyFull,
  ApiCompanyFullContact,
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
  RSSFeed,
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
 * A sector tag.
 *
 * Resolved by NAME against lib/sectors.ts, not by id — see AC-M1 in
 * contracts/company.before.json.
 *
 * This used to read `SECTORS.find(s => s.id === api.id)`, on the assumption
 * that the API's sector `id` indexes the same taxonomy as the master list. It
 * does not. The two id spaces are unrelated, and because both are dense small
 * integers a wrong id silently resolves to a real sector rather than to
 * nothing. Measured on company 82 (Mitsubishi Heavy Industries), id-matching
 * produced:
 *
 *   wire "Aerospace & Defence"    (id 211) -> Aerospace & Defence   [correct, by luck]
 *   wire "Alternative Energy"     (id 190) -> Enterprise IT          [wrong]
 *   wire "Construct, Engineering" (id 217) -> dropped                [no such id]
 *   wire "Energy, Alternatives"   (id 172) -> dropped                [no such id]
 *   wire "Engineering"            (id 208) -> Fashion & Apparel      [wrong]
 *   wire "EVs, Transportation"    (id 252) -> eSports Gaming         [wrong]
 *   wire "Smart Cities"           (id 253) -> Regional               [wrong]
 *
 * A heavy industrial defence contractor tagged Fashion & Apparel, written into
 * CompanyFull and cached. A blank field is visibly missing; a wrong-but-real
 * one is not.
 *
 * Name-matching fixes four of those seven. It cannot fix the other three: the
 * wire's names are not in the master list under any id, so the taxonomies
 * differ in CONTENT, not only in numbering. For those, the wire's own `name`
 * and `description` are kept verbatim rather than guessed at or dropped —
 * which keeps bad upstream data visible instead of silently mislabelled.
 *
 * map-article.ts already matched by name, so before this change the two
 * mappers disagreed with each other about the same company.
 *
 * Note the API can return several sectors for one company. They are all kept,
 * even though the editor and `resolveSector` only read `sectors[0]` — dropping
 * them here would lose data the wire actually holds.
 */
export function mapSector(api: ApiCompanySector): CompanySector {
  const name = str(api.name)
  const master = name ? SECTORS.find(s => s.sector_name === name) : undefined
  return {
    id: api.id,
    company_id: api.compId,
    // The wire's id is retained as-is. It is the key the API knows this sector
    // by, and the id mapping between the two taxonomies is still an open
    // question with the API team — keeping it means the answer can be applied
    // later without re-probing.
    sector_id: api.id,
    sector_type: master?.sector_type ?? str(api.description) ?? '',
    sector_name: master?.sector_name ?? name ?? '',
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
    // DELIBERATELY NOT MAPPED — `api.username` and `api.password`. See AC-M2.
    // The wire returns both in plaintext on an endpoint that needs no sign-in.
    // This app syncs all 9,606 companies, so mapping them wrote 9,606 plaintext
    // credential pairs into IndexedDB, where they persisted across sessions.
    // `blankCompany` leaves both fields null and they stay that way.
    // Backend must strip them from the DTO; until then, not reading them is the
    // only part of this we control.
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
    // DELIBERATELY NOT MAPPED — see AC-M2 on mapCompanyListItem above. The
    // detail endpoint returns the same plaintext credentials as the list one.
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

/**
 * The single-sector fallback, built from the company's `sectorId` column.
 *
 * Unlike `sectors[]`, this column carries no name — only a number — so it can
 * only ever be resolved by id, and per AC-M1 the API's sector ids do not index
 * lib/sectors.ts. Company 82 sends `sectorId: 186`, which matches nothing in
 * the master list (its ids run 26-263 but are a different assignment).
 *
 * So an unresolvable id now yields NO sector rather than a row with an empty
 * `sector_name`, which is what this used to emit. A blank-named sector is not
 * data; it renders as a gap the editor can neither read nor fix, and it is
 * indistinguishable from a company that genuinely has no sector.
 *
 * Keep this narrow. Once the API team supplies the id mapping between the two
 * taxonomies, translate here rather than widening the match.
 */
function sectorFromId(companyId: number, sectorId: number | null): CompanySector[] {
  if (!sectorId) return []
  const master = SECTORS.find(s => s.id === sectorId)
  if (!master) return []
  return [
    {
      id: sectorId,
      company_id: companyId,
      sector_id: sectorId,
      sector_type: master.sector_type,
      sector_name: master.sector_name,
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
 * A contact from a `/full` company.
 *
 * Same person, plainer keys: `name`/`phone`/`email`/`fax`/`position` where the
 * legacy `/api/CompContacts` row used `contactName`/`contactPhone`/
 * `contactEmail`/`contactFax`/`contactPosition`, and `description` where it
 * used `contactDesc`. The id is `id`, not `contId`. Reading the legacy
 * spellings against this shape yields a contact list of blank rows.
 */
export function mapFullContact(
  api: ApiCompanyFullContact,
  companyId: number,
  index = 0
): CompanyContact {
  return {
    id: api.id,
    company_id: companyId,
    name: str(api.name) ?? '',
    position: str(api.position),
    email: str(api.email),
    phone: str(api.phone),
    fax: str(api.fax),
    contact_type: 'freetext',
    email_format: str(api.format)?.toUpperCase() === 'TEXT' ? 'text' : 'html',
    notes: str(api.description),
    sort_order: index,
    created_at: NO_TIMESTAMP,
    updated_at: NO_TIMESTAMP,
  }
}

/**
 * An RSS feed row.
 *
 * The wire carries a name and nothing else — no url, no sector, no status — so
 * the rest stays at the blank-record default rather than being invented. A row
 * with no name is not a feed and is dropped by the caller.
 */
function mapRssFeed(api: { id: number; compId: number; rssName: string | null }): RSSFeed {
  return {
    id: api.id,
    company_id: api.compId,
    feed_name: str(api.rssName) ?? '',
    url: '',
    sector_id: null,
    sector_name: null,
    status: 'active',
    created_at: NO_TIMESTAMP,
    updated_at: NO_TIMESTAMP,
  }
}

/**
 * A company from `GET /api/Companies/{id}/full` — the whole record, one call.
 *
 * This replaces `mapCompanyDetail` + `mapCompanyExtraDetails` + the
 * `/api/CompContacts` leg + the list projection's annual-report fields, all of
 * which `mergeCompanyDetail` used to stitch together from three responses. It
 * is a direct map rather than a merge, so there is no "a blank from one source
 * must not erase a value from another" problem to reason about any more.
 *
 * `sectors`, `tickers` and `bloombergCodes` are byte-identical to their
 * detail-route counterparts (verified on companies 14, 82 and 574), so the
 * existing row mappers take them unchanged and keep matching sectors by NAME.
 *
 * `username`/`password` are not on this shape at all — the backend strips them
 * now. The AC-M2 note on `mapCompanyListItem` records what they used to do.
 */
export function mapCompanyFull(api: ApiCompanyFull): CompanyFull {
  const name = str(api.names?.en) ?? ''
  const base = blankCompany(api.companyId, name)
  const profile = api.profile
  const socials = api.socials
  const extended = str(api.boilerplateExtended)
  const about = str(api.boilerplate)

  return {
    ...base,
    status: STATUS_FOR_API_RECORD,
    name_en: name,
    name_zh_hans: str(api.names?.zhHans),
    name_zh_hant: str(api.names?.zhHant),
    name_ja: str(api.names?.ja),
    name_ko: str(api.names?.ko),
    // Absolute on the wire; the legacy routes sent bare filenames that
    // companyLogoUrl/companyTopLogoUrl had to resolve against the site host.
    logo_article_url: str(api.logoArticle),
    logo_top_url: str(api.logoTop),
    url: str(api.url),
    url_ja: str(api.urlJa),
    legal_name: str(api.legalName),
    country_code: str(api.country),
    about_html: about,

    blog: str(socials?.blog),
    facebook: str(socials?.facebook),
    twitter: str(socials?.twitter),
    youtube: str(socials?.youtube),
    linkedin: str(socials?.linkedin),
    telegram: str(socials?.telegram),
    // The legacy `socials` object has no Instagram; /social-links writes land here.
    instagram: str(api.socialLinks?.find(l => l.platform.toLowerCase() === 'instagram')?.url),

    established: str(profile?.established),
    // `listedDate` here; the legacy /details route spelled it `listed`.
    exchange_listed_date: str(profile?.listedDate),
    employees: str(profile?.employees),
    duns_number: str(profile?.dunsNumber),
    otc: str(profile?.otc),
    market_id: str(profile?.marketId),
    address_street: str(profile?.addressStreet),
    address_district: str(profile?.addressDistrict),
    address_city: str(profile?.addressCity),
    address_country: str(profile?.addressCountry),
    telephone: str(profile?.telephone),
    facsimile: str(profile?.facsimile),
    company_email: str(profile?.email),
    key_person_1_name: str(profile?.keyPerson1Name),
    key_person_1_title: str(profile?.keyPerson1Title),
    key_person_2_name: str(profile?.keyPerson2Name),
    key_person_2_title: str(profile?.keyPerson2Title),

    annual_report_url: annualReportUrl(api.annualReport?.name),
    annual_report_name: str(api.annualReport?.name),
    annual_report_date: str(api.annualReport?.date),
    annual_report_size: str(api.annualReport?.size),

    // `primarySectorId` is the company's own sector column, the legacy
    // `sectorId`. Same fallback rule: it is the authority only when the
    // `sectors` list is empty, which is the common case on the dev host.
    sectors: api.sectors?.length
      ? api.sectors.map(mapSector)
      : sectorFromId(api.companyId, api.primarySectorId),

    // Primary first — the diff treats position 0 as primary.
    industries: [...(api.industries ?? [])]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map(i => ({ industry_id: i.id, industry_name: str(i.name) ?? industryName(i.id) })),
    exchange_listings: api.tickers?.map(mapTicker) ?? [],
    wire_codes: api.bloombergCodes?.map(mapBloombergCode) ?? [],
    rss_feeds: (api.rss ?? []).map(mapRssFeed).filter(feed => feed.feed_name !== ''),
    contacts: (api.contacts ?? []).map((c, i) => mapFullContact(c, api.companyId, i)),

    delivery_settings: {
      ...base.delivery_settings,
      allow_access: api.allowAccess,
      // Same rule as the list projection: the extended copy only tells us the
      // flag should be on when it actually differs from the short one.
      show_extended_boilerplate: !!extended && extended !== about,
    },

    created_at: NO_TIMESTAMP,
    updated_at: NO_TIMESTAMP,
  }
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
