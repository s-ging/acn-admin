// src/lib/api/endpoints.ts
// One function per operation in the swagger document, with the server's own
// parameter names and constraints kept intact.
//
// All seventeen operations are covered. They return wire shapes, not app models
// — mapping to CompanyFull / PressRelease happens in ./map-company.ts and
// ./map-article.ts, so a caller that just wants to read the API can.
//
// Note the THREE casings for paging, all of them the server's inconsistency
// rather than typos here:
//   Page/Size             /api/Articles, /api/Articles/search, /api/Companies,
//                         /api/Companies/{id}
//   pageNumber/pageSize   /api/Articles/by-industry, /by-company, /api/Events
//   PageNumber/PageSize   /api/Events/full
//
// The `/full` routes (/api/Events/full, /api/Events/{id}/full,
// /api/Companies/{id}/full) and /api/Sectors were added alongside the originals,
// which all still answer. See the ApiEventFull and ApiCompanyFull notes in
// ./types.ts for what moved between the two shapes.

import { apiGet } from './client'
import type {
  ApiArticleFeedItem,
  ApiArticleListItem,
  ApiCompanyContact,
  ApiCompanyDetail,
  ApiCompanyExtraDetails,
  ApiCompanyFull,
  ApiCompanyListItem,
  ApiEvent,
  ApiEventFull,
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
 * `GET /api/Companies/{id}/full` — the whole company in ONE request.
 *
 * Supersedes calling `fetchCompany` + `fetchCompanyDetails` +
 * `fetchCompanyContacts` and merging the three, and additionally carries the
 * annual-report and extended-boilerplate fields that used to be reachable only
 * through the LIST projection. Takes no paging parameters: the contacts come
 * back whole rather than as a page.
 */
export function fetchCompanyFull(
  id: number,
  signal?: AbortSignal
): Promise<ApiCompanyFull> {
  return apiGet<ApiCompanyFull>(`/api/Companies/${id}/full`, undefined, signal)
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
 * `GET /api/Events/full`
 *
 * The reconciled event shape. Three things to know before using it:
 *
 *  1. PUBLISHED-ONLY. 816 rows, not 839 — the 23 events the wire marks
 *     unpublished are absent, and this is an admin panel, so `loadAllEvents`
 *     still sweeps the legacy route to keep them visible and editable.
 *  2. `PageSize` is NOT capped at 100 the way `Size` is on /api/Companies;
 *     2000 returns the whole set in one request, at 286KB against the legacy
 *     sweep's 2.65MB for the same data.
 *  3. Capitalised paging parameters, unlike the legacy /api/Events.
 *
 * `Upcoming`, `From` and `To` are server-side filters with no legacy
 * equivalent — all verified answering correctly.
 */
export function fetchEventsFull(
  params: {
    pageNumber?: number
    pageSize?: number
    upcoming?: boolean
    /** `YYYY-MM-DD`. Filters on the event's start date. */
    from?: string
    to?: string
  } = {},
  signal?: AbortSignal
): Promise<ApiEventFull[]> {
  return apiGet<ApiEventFull[]>(
    '/api/Events/full',
    {
      PageNumber: params.pageNumber,
      PageSize: params.pageSize,
      Upcoming: params.upcoming,
      From: params.from,
      To: params.to,
    },
    signal
  )
}

/**
 * `GET /api/Events/{id}/full` — a working single-event read, at last.
 *
 * This is the route that fixes AE-M5. Note the fix landed HERE and not on
 * `/api/Events/{id}`, which still answers 500 with the same
 * "required column 'Companies' was not present" error it has since 2026-09-07.
 *
 * 404s for an unpublished id as well as an unknown one, since /full is a
 * published-only projection.
 */
export function fetchEventFull(id: number, signal?: AbortSignal): Promise<ApiEventFull> {
  return apiGet<ApiEventFull>(`/api/Events/${id}/full`, undefined, signal)
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
