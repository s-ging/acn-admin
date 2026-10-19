// src/lib/api/types.ts
// The wire shapes the ACN Newswire API actually returns.
//
// The swagger document declares every 200 response as a bare {"description":
// "OK"} with no schema, so none of this could be generated — it is transcribed
// from live responses off development.acnnewswire.com. Anything the server
// leaves out on some records is typed optional, and every string the server has
// been seen to send as null on some rows and "" on others is `string | null`.
//
// Casing is the server's, not ours: it mixes `companyId` (list, contacts) with
// `companyID` (the nested company on an article), and `logoFilename` with
// `logoFileName`. The mappers absorb that; nothing outside this folder should
// have to know.

/** A row of `GET /api/Companies`. */
export interface ApiCompanyListItem {
  companyId: number
  companyNameEN: string | null
  companyNameCH: string | null
  companyNameCT: string | null
  companyNameJP: string | null
  companyNameKO: string | null
  logoFilename: string | null
  topLogoFilename: string | null
  boilerPlate: string | null
  extBoilerPlate: string | null
  reportFilename: string | null
  reportFileDate: string | null
  reportFileSize: string | null
  username: string | null
  password: string | null
  url: string | null
}

/** A sector tag on a company — `id` indexes the same taxonomy as lib/sectors.ts. */
export interface ApiCompanySector {
  compId: number
  id: number
  name: string | null
  description: string | null
}

/** A Bloomberg distribution code. `name` is the human label for the code. */
export interface ApiBloombergCode {
  compId: number
  id: number
  bloombergCode: string | null
  name: string | null
}

/** An exchange listing. `isin` is often "" rather than absent. */
export interface ApiTicker {
  id: number
  compId: number
  exchangeId: string | null
  exchangeName: string | null
  tickerId: string | null
  isin: string | null
}

/**
 * A contact. Two endpoints return this under different field sets: the copy
 * embedded in `GET /api/Companies/{id}` carries only name/phone/email, while
 * `GET /api/CompContacts` adds position, fax, description and format. The extra
 * fields are optional so both sources can share one type.
 */
export interface ApiCompanyContact {
  contId: number
  compId?: number
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  contactPosition?: string | null
  contactFax?: string | null
  contactDesc?: string | null
  /** Seen as "HTML"; mapped to the editor's `email_format`. */
  format?: string | null
}

/**
 * An RSS feed row. Never observed populated on the dev host — every company
 * sampled returned `rss: []` — so the real field names are unknown. Left as an
 * open record so the mapper can keep the rows rather than silently drop them.
 */
export type ApiRssFeed = Record<string, unknown>

/** `GET /api/Companies/{id}`. The `contacts` list is the paginated part of the response. */
export interface ApiCompanyDetail {
  companyId: number
  companyName: string | null
  /** A second English name, distinct from the localised ones. */
  companyName2: string | null
  companyNameJP: string | null
  companyNameCH: string | null
  companyNameCT: string | null
  companyNameKO: string | null
  ticker: string | null
  url: string | null
  boilerPlate: string | null
  sectorId: number | null
  topLogoFilename: string | null
  logoFilename: string | null
  username: string | null
  password: string | null
  allowAccess: boolean
  blog: string | null
  facebook: string | null
  twitter: string | null
  youTube: string | null
  linkedIn: string | null
  telegram: string | null
  rss: ApiRssFeed[]
  bloomberg: ApiBloombergCode[]
  sectors: ApiCompanySector[]
  tickers: ApiTicker[]
  contacts: ApiCompanyContact[]
  // Echoed paging state for the `contacts` list.
  page: number
  size: number
  sort1: string | null
  ord1: string | null
}

/**
 * `GET /api/Companies/{id}/details` — the profile fields the main record omits.
 * Every field here comes back as "" rather than null when unset.
 *
 * `addr1`..`addr4` are street, district, city, country in that order, matching
 * the four address fields on the editor's Company details tab.
 */
export interface ApiCompanyExtraDetails {
  established: string | null
  listed: string | null
  employees: string | null
  dunsNumber: string | null
  otc: string | null
  marketId: string | null
  urlJa: string | null
  blog: string | null
  facebook: string | null
  twitter: string | null
  linkedIn: string | null
  youTube: string | null
  telegram: string | null
  addr1: string | null
  addr2: string | null
  addr3: string | null
  addr4: string | null
  telephone: string | null
  facsimile: string | null
  email: string | null
  pos1Name: string | null
  pos1Desc: string | null
  pos2Name: string | null
  pos2Desc: string | null
}

/** The company credited on an article. Note `companyID` — capital D, unlike elsewhere. */
export interface ApiArticleCompany {
  companyID: number
  companyName: string | null
  companyNameCH: string | null
  companyNameCT: string | null
  companyNameJP: string | null
  companyNameKO: string | null
  companyURL: string | null
  logoFileName: string | null
  topLogoFileName: string | null
  sectorName: string | null
}

/** A photo on an article. Both fields are bare filenames — see ./media.ts. */
export interface ApiArticleImage {
  thumbImage: string | null
  bigImage: string | null
  caption: string | null
}

/**
 * A row of `GET /api/Articles`. The by-industry, by-company and homepage
 * endpoints return a different, fuller row — see `ApiArticleFeedItem`.
 */
export interface ApiArticleListItem {
  articleId: number
  headline: string | null
  publishDate: string | null
  summary: string | null
  hasImage: boolean
  imageUrl: string | null
  /** "EN" | "JA" | "ZH-CN" | "ZH-TW" on every row sampled. */
  language: string | null
  companies: {
    companyId: number
    companyName: string | null
    logoFilename: string | null
  }[]
  images: ApiArticleImage[]
}

/**
 * A row of `GET /api/Articles/by-industry`, `/by-company/{id}` and `/homepage`.
 * These carry the article's sector and source but no `language`, and nest the
 * fuller company shape — the opposite trade from `ApiArticleListItem`.
 */
export interface ApiArticleFeedItem {
  articleId: number
  headline: string | null
  publishDate: string | null
  summary: string | null
  sourceId: number | null
  hasImage: boolean
  hasFile: boolean
  sectorName: string | null
  companies: ApiArticleCompany[]
  images: ApiArticleImage[]
}

/**
 * `GET /api/Articles/press-release/{artId}` — the full release.
 *
 * `body` has been null on every record sampled; `bodyHtml` is the markup the
 * editor wants and `bodyText` the flattened copy.
 */
export interface ApiPressRelease {
  articleId: number
  headline: string | null
  subHeadLine: string | null
  body: string | null
  bodyText: string | null
  bodyHtml: string | null
  publishDate: string | null
  summary: string | null
  sourceId: number | null
  sourceName: string | null
  /**
   * "EN" | "ZH-TW" on the records sampled — the same tag set as
   * `ApiArticleListItem.language`, resolved through LANGUAGE_BY_API_TAG.
   *
   * This endpoint DOES return it (AP-M3). It was previously undeclared, and
   * `mapPressRelease` took the value from the cached list row instead, so a
   * cold-cache open lost it. Optional because it was only confirmed on the
   * records probed on 2026-09-10, not across the whole corpus.
   */
  language?: string | null
  hasImage: boolean
  hasFile: boolean
  companies: ApiArticleCompany[]
  images: ApiArticleImage[]
  /** Sector *names*, matching `sector_name` in lib/sectors.ts. */
  sectors: string[]
  /**
   * A constant "Press release summary" on every record sampled — a section
   * label, not a topic, so the mapper does not write it to `topic`.
   */
  topicName: string | null
}

/**
 * A press release filed against an event's organiser, from
 * `GET /api/Events/company/{companyId}/year/{year}`.
 *
 * Despite living under /api/Events this is an *article* row, not an event one —
 * a different shape from `ApiEvent` entirely, and the only endpoint that returns
 * it. `systemDate` is the field name; there is no `publishDate` here.
 */
export interface ApiEventRelease {
  articleId: number
  headline: string | null
  summary: string | null
  systemDate: string | null
  companyId: number | null
}

/**
 * A row of `GET /api/Events`.
 *
 * Also the source for a single event: `GET /api/Events/{id}` answers 500 for
 * every id tried, so there is no detail shape to model.
 */
export interface ApiEvent {
  id: number
  startDate: string | null
  endDate: string | null
  description: string | null
  location: string | null
  url: string | null
  /** A relative legacy-site link, e.g. `events.asp?compid=23&yr=2007`. */
  inUrl: string | null
  /** A bare filename. The serving path for these is not known — see ./media.ts. */
  eventImage: string | null
  lid: string | null
  /** "y" / "n". */
  publish: string | null
  compId: number | null
  /**
   * The organiser, repeated once per release it has — up to 168 identical
   * entries on one event. `mapEvent` collapses them.
   */
  companies: ApiArticleCompany[]
}

// ── The /full projections ───────────────────────────────────────────────────
//
// Added by the API team on top of the existing routes rather than in place of
// them, so both shapes are live and both are modelled here. The /full routes
// are the reconciled shapes from ../../../../contracts/*.after.json: renamed
// fields, real timezone offsets, absolute URLs, booleans instead of "y", and
// the sub-lists deduped and merged server-side.

/** An organiser on a `/full` event. Deduped upstream; URLs absolute. */
export interface ApiEventOrganiser {
  id: number
  name: string | null
  /** Absolute. The legacy shape sent a bare filename in `logoFileName`. */
  logo: string | null
  url: string | null
}

/**
 * A row of `GET /api/Events/full`, and the body of `GET /api/Events/{id}/full`.
 *
 * Differences from `ApiEvent` that will bite if assumed away:
 *   · `name` carries what `description` used to.
 *   · dates carry a real `+08:00` offset, and `endDate` is 23:59:59 of its day.
 *   · `url` and `photo` are absolute.
 *   · `publish: "y"` became `isPublished: true`.
 *   · `compId`/`companies[]` became `organiserId`/`organisers[]`, deduped.
 *   · `lid`, `inUrl` and `pressReleaseUrl` are gone — none held information.
 *
 * PUBLISHED-ONLY. The 23 events the wire marks unpublished are absent from the
 * list and 404 on the detail route, which is why `loadAllEvents` still sweeps
 * the legacy endpoint alongside this one.
 */
export interface ApiEventFull {
  id: number
  name: string | null
  startDate: string | null
  endDate: string | null
  location: string | null
  url: string | null
  photo: string | null
  isPublished: boolean
  organiserId: number | null
  organisers: ApiEventOrganiser[] | null
}

/** A contact on a `/full` company — the rich shape, without the extra call. */
export interface ApiCompanyFullContact {
  id: number
  name: string | null
  position: string | null
  phone: string | null
  email: string | null
  fax: string | null
  description: string | null
  /** "HTML" / "TEXT". */
  format: string | null
  type: string | null
}

/**
 * An RSS feed row.
 *
 * The shape was an open question for as long as `rss` came back empty on every
 * company sampled. Company 574 populates it: `{ compId, id, rssName }`. There
 * is no URL, sector or status on the wire — only the feed's name.
 */
export interface ApiCompanyRss {
  compId: number
  id: number
  rssName: string | null
}

/** The annual report, promoted out of the list projection's flat fields. */
export interface ApiCompanyAnnualReport {
  name: string | null
  date: string | null
  size: string | null
}

/**
 * `GET /api/Companies/{id}/full` — the whole company in one request.
 *
 * Replaces the three-call merge of `/api/Companies/{id}`, `/details` and
 * `/api/CompContacts`, and folds in the annual-report and extended-boilerplate
 * fields that previously only the LIST projection carried. `sectors`, `tickers`
 * and `bloombergCodes` are byte-identical to their detail-route counterparts,
 * so the existing row mappers take them unchanged.
 *
 * `username` and `password` are absent. They used to come back in plaintext on
 * this unauthenticated endpoint (AC-M2); the backend now strips them from every
 * company DTO. Nothing here reads them, and nothing should start.
 */
export interface ApiCompanyFull {
  companyId: number
  names: {
    en: string | null
    ja: string | null
    zhHans: string | null
    zhHant: string | null
    ko: string | null
  } | null
  url: string | null
  urlJa: string | null
  /** Absolute URLs, not the bare filenames the legacy routes sent. */
  logoArticle: string | null
  logoTop: string | null
  boilerplate: string | null
  boilerplateExtended: string | null
  allowAccess: boolean
  /** The company's own sector column — the legacy `sectorId`. */
  primarySectorId: number | null
  profile: {
    established: string | null
    /** The legacy `/details` field was spelled `listed`. */
    listedDate: string | null
    employees: string | null
    dunsNumber: string | null
    otc: string | null
    marketId: string | null
    /** Named, where the legacy route had positional addr1..addr4. */
    addressStreet: string | null
    addressDistrict: string | null
    addressCity: string | null
    addressCountry: string | null
    telephone: string | null
    facsimile: string | null
    email: string | null
    keyPerson1Name: string | null
    keyPerson1Title: string | null
    keyPerson2Name: string | null
    keyPerson2Title: string | null
  } | null
  /** One object. The legacy routes spelled these `youTube` and `linkedIn`. */
  socials: {
    blog: string | null
    facebook: string | null
    twitter: string | null
    youtube: string | null
    linkedin: string | null
    telegram: string | null
  } | null
  annualReport: ApiCompanyAnnualReport | null
  sectors: ApiCompanySector[]
  tickers: ApiTicker[]
  /** Renamed from the legacy `bloomberg`. */
  bloombergCodes: ApiBloombergCode[]
  rss: ApiCompanyRss[]
  contacts: ApiCompanyFullContact[]
}

// ── Writes ──────────────────────────────────────────────────────────────────
//
// Unlike the read shapes above, these ARE declared in the spec
// (components.schemas), so they are transcribed from it rather than from the
// wire. On the Update* shapes every field is optional — an absent field is left
// as it is, which is why the company save sends only what changed.

/** `GET /api/Sectors` — the wire's own sector taxonomy, the id space `industryId` uses. */
export interface ApiSector {
  id: number
  name: string | null
  description: string | null
  subId: number | null
  title: string | null
}

export interface ApiCompanyBasicInfo {
  companyNameEN?: string | null
  companyNameCH?: string | null
  companyNameCT?: string | null
  companyNameJP?: string | null
  companyNameKO?: string | null
  logoFilename?: string | null
  topLogoFilename?: string | null
  boilerPlate?: string | null
  extBoilerPlate?: string | null
  reportFilename?: string | null
  reportFileDate?: string | null
  reportFileSize?: string | null
  url?: string | null
  /** max 200 */
  legalName?: string | null
  countryCode?: string | null
}

/** The legacy `/details` field names, unchanged. */
export type ApiCompanyDetailsWrite = Partial<Record<keyof ApiCompanyExtraDetails, string | null>>

/** `POST /api/Companies`. `basicInfo.companyNameEN` is required. */
export interface CreateCompanyDto {
  basicInfo: ApiCompanyBasicInfo & { companyNameEN: string }
  details?: ApiCompanyDetailsWrite
}

/** `PUT /api/Companies/{id}`. */
export interface UpdateCompanyDto {
  basicInfo?: ApiCompanyBasicInfo
  details?: ApiCompanyDetailsWrite
}

/** `PUT /api/Companies/{companyId}/industries/{industryId}`. */
export interface SaveCompanyIndustryDto {
  isPrimary?: boolean | null
}

/** `POST /api/Companies/{companyId}/listings`. `mic` is the `exchangeId` on reads. */
export interface CreateCompanyListingDto {
  mic: string
  /** max 20 */
  ticker: string
  isPrimary?: boolean
  sortOrder?: number
}

/** `PUT /api/Companies/{companyId}/listings/{mic}/{ticker}`. */
export interface UpdateCompanyListingDto {
  isPrimary?: boolean | null
  sortOrder?: number | null
}

/** `PUT /api/Companies/{companyId}/social-links/{platform}`. */
export interface SaveCompanySocialLinkDto {
  /** max 300 */
  url: string
}

/**
 * `POST /api/Events` / `PUT /api/Events/{id}`.
 *
 * The `/full` field names, not the legacy ones: `name` not `description`,
 * `isPublished` not a "y"/" " string, `organiserId` not `compId`. Dates are
 * date-only `YYYY-MM-DD`. `name` and `startDate` are required on create.
 */
export interface SaveEventDto {
  name?: string | null
  startDate?: string | null
  endDate?: string | null
  location?: string | null
  url?: string | null
  eventImage?: string | null
  isPublished?: boolean | null
  organiserId?: number | null
}
