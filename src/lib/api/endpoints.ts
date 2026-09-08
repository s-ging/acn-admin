// src/lib/api/endpoints.ts
// One function per operation in the swagger document, with the server's own
// parameter names and constraints kept intact.
//
// All thirteen operations are covered. They return wire shapes, not app models
// — mapping to CompanyFull / PressRelease happens in ./map-company.ts and
// ./map-article.ts, so a caller that just wants to read the API can.
//
// Note the two casings for paging: /api/Articles, /api/Articles/search,
// /api/Companies and /api/Companies/{id} take `Page`/`Size`, while
// /api/Articles/by-industry, /by-company and /api/Events take
// `pageNumber`/`pageSize`. That is the server's inconsistency, not a typo here.

import { apiGet } from './client'
import type {
  ApiArticleFeedItem,
  ApiArticleListItem,
  ApiCompanyContact,
  ApiCompanyDetail,
  ApiCompanyExtraDetails,
  ApiCompanyListItem,
  ApiEvent,
  ApiEventRelease,
  ApiPressRelease,
} from './types'

/** `Size` is capped at 100 by the server; asking for more is a 400. */
export const MAX_PAGE_SIZE = 100

// ── Articles ────────────────────────────────────────────────────────────────

export interface ArticleListParams {
  page?: number
  size?: number
  /** The server's `ArtType`. No enumeration of the values is published. */
  artType?: number
  /** The server's `SecId` — a sector id from lib/sectors.ts. */
  secId?: number
  /** The server's `Cid` — a company id. */
  cid?: number
  hasThumbnail?: boolean
}

/** `GET /api/Articles` */
export function fetchArticles(
  params: ArticleListParams = {},
  signal?: AbortSignal
): Promise<ApiArticleListItem[]> {
  return apiGet<ApiArticleListItem[]>(
    '/api/Articles',
    {
      Page: params.page,
      Size: params.size,
      ArtType: params.artType,
      SecId: params.secId,
      Cid: params.cid,
      HasThumbnail: params.hasThumbnail,
    },
    signal
  )
}

/** `GET /api/Articles/homepage` — returned `[]` on the dev host when sampled. */
export function fetchHomepageArticles(
  hasThumbnail = false,
  signal?: AbortSignal
): Promise<ApiArticleFeedItem[]> {
  return apiGet<ApiArticleFeedItem[]>('/api/Articles/homepage', { hasThumbnail }, signal)
}

/** `GET /api/Articles/by-industry` — `industry` matches a `sector_name`. */
export function fetchArticlesByIndustry(
  params: { industry?: string; pageNumber?: number; pageSize?: number; hasThumbnail?: boolean } = {},
  signal?: AbortSignal
): Promise<ApiArticleFeedItem[]> {
  return apiGet<ApiArticleFeedItem[]>('/api/Articles/by-industry', { ...params }, signal)
}

export interface ArticleSearchParams {
  exchangeId?: string
  sectorName?: string
  companyName?: string
  tickerId?: string
  country?: string
  page?: number
  size?: number
}

/**
 * `GET /api/Articles/search`
 *
 * Every filter is an exact-match lookup on the wire, not a substring search:
 * `CompanyName=Umetal` came back empty for a company that exists. Prefer
 * filtering `fetchArticles` client-side unless you have exact values.
 */
export function searchArticles(
  params: ArticleSearchParams = {},
  signal?: AbortSignal
): Promise<ApiArticleListItem[]> {
  return apiGet<ApiArticleListItem[]>(
    '/api/Articles/search',
    {
      ExchangeId: params.exchangeId,
      SectorName: params.sectorName,
      CompanyName: params.companyName,
      TickerId: params.tickerId,
      Country: params.country,
      Page: params.page,
      Size: params.size,
    },
    signal
  )
}

/** `GET /api/Articles/by-company/{companyId}` */
export function fetchArticlesByCompany(
  companyId: number,
  params: { pageNumber?: number; pageSize?: number; hasThumbnail?: boolean } = {},
  signal?: AbortSignal
): Promise<ApiArticleFeedItem[]> {
  return apiGet<ApiArticleFeedItem[]>(
    `/api/Articles/by-company/${companyId}`,
    { ...params },
    signal
  )
}

/** `GET /api/Articles/press-release/{artId}` — the full release body. */
export function fetchPressRelease(
  artId: number,
  signal?: AbortSignal
): Promise<ApiPressRelease> {
  return apiGet<ApiPressRelease>(`/api/Articles/press-release/${artId}`, undefined, signal)
}

// ── Companies ───────────────────────────────────────────────────────────────

/** `GET /api/Companies` */
export function fetchCompanies(
  params: { page?: number; size?: number } = {},
  signal?: AbortSignal
): Promise<ApiCompanyListItem[]> {
  return apiGet<ApiCompanyListItem[]>(
    '/api/Companies',
    { Page: params.page, Size: params.size },
    signal
  )
}

/** The server validates these two against a regex and 400s on anything else. */
export type ContactSortField = 'Cont_Name' | 'Contact_Phone' | 'Contact_Type'
export type SortOrder = 'ASC' | 'DESC'

/**
 * `GET /api/Companies/{id}`
 *
 * `Page`/`Size`/`Sort1`/`Ord1` page and sort the embedded `contacts` list, not
 * the company itself.
 */
export function fetchCompany(
  id: number,
  params: { page?: number; size?: number; sort1?: ContactSortField; ord1?: SortOrder } = {},
  signal?: AbortSignal
): Promise<ApiCompanyDetail> {
  return apiGet<ApiCompanyDetail>(
    `/api/Companies/${id}`,
    { Page: params.page, Size: params.size, Sort1: params.sort1, Ord1: params.ord1 },
    signal
  )
}

/** `GET /api/Companies/{id}/details` — address, key people and profile fields. */
export function fetchCompanyDetails(
  id: number,
  signal?: AbortSignal
): Promise<ApiCompanyExtraDetails> {
  return apiGet<ApiCompanyExtraDetails>(`/api/Companies/${id}/details`, undefined, signal)
}

/**
 * `GET /api/CompContacts`
 *
 * Richer than the `contacts` embedded in `fetchCompany` — this is the only
 * source for a contact's position, fax, description and email format.
 */
export function fetchCompanyContacts(
  params: { companyId?: number; contactId?: number } = {},
  signal?: AbortSignal
): Promise<ApiCompanyContact[]> {
  return apiGet<ApiCompanyContact[]>('/api/CompContacts', { ...params }, signal)
}

// ── Events ──────────────────────────────────────────────────────────────────

/** `GET /api/Events` */
export function fetchEvents(
  params: { pageNumber?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<ApiEvent[]> {
  return apiGet<ApiEvent[]>('/api/Events', { ...params }, signal)
}

/**
 * `GET /api/Events/{id}`
 *
 * BROKEN SERVER-SIDE — answers 500 for every id tried, including ids taken
 * straight out of the list response (163, 177, 155, 1). There is no working
 * detail endpoint, so a single event has to come from `fetchEvents`; see
 * `loadEventRecord` in ./repository.ts.
 *
 * Kept because it is in the spec and because it will presumably be fixed. Do
 * not build on it without checking it answers 200 first.
 */
export function fetchEvent(id: number, signal?: AbortSignal): Promise<ApiEvent> {
  return apiGet<ApiEvent>(`/api/Events/${id}`, undefined, signal)
}

/**
 * `GET /api/Events/company/{companyId}/year/{year}`
 *
 * Returns press releases, NOT events — see `ApiEventRelease`. The path says
 * Events because it answers "what did this organiser put out in this year",
 * which is how an event page fills its release feed: pass the event's `compId`
 * and the year of its `startDate`.
 */
export function fetchEventReleases(
  companyId: number,
  year: number,
  signal?: AbortSignal
): Promise<ApiEventRelease[]> {
  return apiGet<ApiEventRelease[]>(
    `/api/Events/company/${companyId}/year/${year}`,
    undefined,
    signal
  )
}
