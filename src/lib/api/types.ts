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
