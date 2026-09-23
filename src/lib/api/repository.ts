// src/lib/api/repository.ts
// Loading a record without the caller having to know where it came from.
//
// There are two sources and they are not interchangeable:
//
//   the API  — read-only (every operation in the swagger document is a GET),
//              authoritative for anything already on the wire
//   local    — localStorage, the only place an edit or a new record can go
//
// So a company can be on the wire, local-only (a draft someone started here),
// or both — and when it is both, the local copy wins if it has been edited.
// That precedence lives in `cacheCompany` / `cacheArticle`; these functions
// arrange the fetching around it and fold in the local-only records, which
// would otherwise vanish from a list as soon as the list came from the API.
//
// ── How much there is, and how it is cached ─────────────────────────────────
//
// The API returns bare arrays: no envelope, no total-count header, no Link
// header. The only way to learn how much exists is to page until a page comes
// back short. Measured against the dev host:
//
//   companies    9,439   4.3 MB on the wire   ~2s at PAGE_CONCURRENCY
//   articles    78,874   ~70 MB on the wire   minutes
//
// Companies are therefore synced in full and cached; articles are paged. That
// is not a preference, it is the only split the numbers allow — 78,874 releases
// would be ~140 MB as PressRelease records.
//
// Everything here is CACHE-FIRST. A load resolves from IndexedDB the moment
// there is anything cached, and only goes to the wire when the cache is empty
// or `staleAfter` has passed. That is what keeps the API quiet: a full company
// sync is ~95 requests, so doing it once an hour and serving thousands of reads
// from the cache is far lighter than fetching a page on every click. It is also
// what makes the app work offline — a failed fetch falls back to the cache, and
// the next successful one reconciles.
//
// Two stores, two jobs, and the difference matters:
//
//   IndexedDB (./cache.ts) — what the wire said. Disposable; drop it any time.
//   localStorage (../*/storage.ts) — edits and records created here. The ONLY
//     copy, because the API is read-only. Never overwritten by a fetch.
//
// A list is assembled from both: wire records, with locally edited ones
// overlaid in place, plus locally created ones appended. See `overlayLocalEdits`
// and `localExtras`.

import {
  fetchCompanies,
  fetchCompanyFull,
  fetchArticles,
  fetchEventReleases,
  fetchEventFull,
  fetchEvents,
  fetchEventsFull,
  fetchPressRelease,
  MAX_PAGE_SIZE,
} from './endpoints'
import { ApiError } from './client'
import { cacheGet, cacheKeys, cacheSet, isStale } from './cache'
import { mapCompanyFull, mapCompanyListItem } from './map-company'
import { companyNamesFromRows, mapArticleListItem, mapPressRelease } from './map-article'
import { eventYear, isPublished, mapEvent, mapEventFull, mapEventRelease } from './map-event'
import {
  cacheCompany,
  isLocallyEdited as isCompanyEdited,
  loadCompanies,
  loadCompany,
} from '../companies/storage'
import {
  cacheArticle,
  cacheArticles,
  isLocallyEdited as isArticleEdited,
  loadArticle,
  loadArticles,
} from '../press-releases/storage'
import type { CompanyFull } from '../../types/company.types'
import type { PressRelease } from '../../types/press-release.types'
import type { Event, EventRelease } from '../../types/event.types'

export interface PageParams {
  page?: number
  size?: number
}

/**
 * How many pages to request at once when paging through everything.
 *
 * Eight keeps the 95 company pages to twelve round trips (~2s) without opening
 * so many sockets that the browser queues them anyway. Raising it stops helping
 * once the connection pool saturates.
 */
const PAGE_CONCURRENCY = 8

/** A guard against paging forever if the server stops honouring `Page`. */
const MAX_PAGES = 400

/**
 * What a list load produced, and whether the wire answered.
 *
 * `error` is carried rather than thrown because a dead API is not a dead page:
 * local records are still perfectly usable, so the list renders them and the UI
 * says the wire is unreachable. Throwing would take the whole page down.
 */
export interface ListResult<T> {
  records: T[]
  /** How many came from the API, before local-only records were folded in. */
  fromApi: number
  error: ApiError | null
}

/**
 * Whether a record originated here rather than on the wire.
 *
 * The tell is the timestamp. `blankCompany` and `createArticle` stamp
 * `created_at` with the current time; the mappers deliberately leave it empty,
 * because the API exposes no audit timestamps to fill it with. So a non-empty
 * `created_at` means a person created this record in this app.
 *
 * Editing a wire record does not change this: `saveCompany` and the sheet's
 * `touch` move `updated_at`, never `created_at`, so an edited wire record still
 * reads as belonging to the wire — which it does.
 */
function isLocalOnly(record: { created_at: string }): boolean {
  return !!record.created_at
}

/**
 * The records that exist only here, and so must be shown alongside whatever the
 * API returned — otherwise a draft would vanish from the list the moment the
 * list started coming from the wire.
 *
 * Restricted to genuinely local records rather than "anything the API response
 * didn't mention". That distinction is invisible on a list that fetches
 * everything, but on a *paged* list it is the difference between working and
 * not: releases are cached page by page as they are browsed, so by page two
 * "not in this response" would mean all fifty rows of page one, and they would
 * be folded back in as extras on every subsequent page.
 */
function localExtras<T extends { id: number; created_at: string }>(
  all: T[],
  apiIds: Set<number>
): T[] {
  return all.filter(r => isLocalOnly(r) && !apiIds.has(r.id))
}

/**
 * Every row the endpoint has, fetched a batch of pages at a time.
 *
 * Stops on the first short page, which is the only end-of-data signal the API
 * gives — there is no total count anywhere in the response. Pages within a
 * batch run together, so a short page does not strand the pages beside it:
 * everything already fetched is kept, and only the *next* batch is skipped.
 */
async function pageThrough<T>(
  fetchPage: (page: number, size: number) => Promise<T[]>,
  signal?: AbortSignal
): Promise<T[]> {
  const rows: T[] = []

  for (let page = 1; page <= MAX_PAGES; page += PAGE_CONCURRENCY) {
    const batch = Array.from({ length: PAGE_CONCURRENCY }, (_, i) => page + i)
    const results = await Promise.all(batch.map(p => fetchPage(p, MAX_PAGE_SIZE)))

    let reachedEnd = false
    for (const result of results) {
      rows.push(...result)
      if (result.length < MAX_PAGE_SIZE) reachedEnd = true
    }
    if (reachedEnd) break

    signal?.throwIfAborted()
  }

  return rows
}

/**
 * A locally edited record replaces its wire copy in a list.
 *
 * Without this an edited company would show its old name in the list until the
 * cache happened to be re-read, because the list is now served straight from
 * the API rather than from the localStorage the editor writes to.
 */
function overlayLocalEdits<T extends { id: number }>(fromApi: T[], local: T[]): T[] {
  const localById = new Map(local.map(r => [r.id, r]))
  return fromApi.map(r => localById.get(r.id) ?? r)
}

// ── Companies ───────────────────────────────────────────────────────────────

/**
 * How long a cached list stays good before a load will refresh it.
 *
 * An hour, because nothing in this app can change what the wire says — the API
 * is read-only — so the only thing staleness protects against is a release
 * being published elsewhere. A shorter window would buy accuracy nobody asked
 * for at the cost of the API calls this cache exists to avoid.
 */
export const DEFAULT_STALE_AFTER = 60 * 60 * 1000

export interface LoadOptions {
  /** Ignore the cache and go to the wire. What a "Refresh" control passes. */
  force?: boolean
  /** Override the staleness window. */
  staleAfter?: number
  signal?: AbortSignal
}

/** Where a list's records came from, so the UI can say so. */
export type ListOrigin = 'cache' | 'network' | 'local'

export interface CachedListResult<T> extends ListResult<T> {
  origin: ListOrigin
  /** When the wire data was fetched, epoch ms — null if it never was. */
  syncedAt: number | null
  /**
   * How many records the wire holds in total, independent of how many are in
   * `records`. For companies that is simply the count; for articles it is
   * discovered by `countArticles` and may be null until it is known.
   */
  total: number | null
}

/**
 * Every company on the wire, plus every company that exists only here.
 *
 * Cache-first: the cached snapshot is returned as-is when it is fresh, so
 * navigating back to the list costs no requests at all. A miss or a stale entry
 * triggers the full 95-page sync, which is then cached as one entry.
 *
 * Local edits are overlaid on every path, cache included — the cache holds what
 * the wire said, never what someone changed, so the overlay has to happen on
 * read rather than being baked in.
 */
export async function loadAllCompanies(
  { force = false, staleAfter = DEFAULT_STALE_AFTER, signal }: LoadOptions = {}
): Promise<CachedListResult<CompanyFull>> {
  const local = loadCompanies()
  const cached = force ? null : await cacheGet<CompanyFull[]>(cacheKeys.allCompanies)

  const assemble = (
    wire: CompanyFull[],
    origin: ListOrigin,
    syncedAt: number | null,
    error: ApiError | null = null
  ): CachedListResult<CompanyFull> => {
    const fromApi = overlayLocalEdits(wire, local)
    const apiIds = new Set(fromApi.map(c => c.id))
    return {
      records: [...fromApi, ...localExtras(local, apiIds)],
      fromApi: fromApi.length,
      total: origin === 'local' ? null : fromApi.length,
      origin,
      syncedAt,
      error,
    }
  }

  if (cached && !isStale(cached, staleAfter)) {
    return assemble(cached.value, 'cache', cached.savedAt)
  }

  try {
    const rows = await pageThrough(
      (page, size) => fetchCompanies({ page, size }, signal),
      signal
    )
    const wire = rows.map(mapCompanyListItem)
    // Cached without the local overlay, so it stays a faithful record of the wire.
    await cacheSet(cacheKeys.allCompanies, wire)
    return assemble(wire, 'network', Date.now())
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    const error = err instanceof ApiError ? err : new ApiError(0, '', String(err))

    // Offline, or the wire is down. A stale cache is still every company, and
    // far better than an empty list — this is the "reconvene when back online"
    // half of the arrangement.
    if (cached) return assemble(cached.value, 'cache', cached.savedAt, error)

    return { records: local, fromApi: 0, total: null, origin: 'local', syncedAt: null, error }
  }
}

/**
 * One complete company.
 *
 * ONE call. This used to be three — `/api/Companies/{id}` for the sectors,
 * tickers and social links, `/details` for the address and key people, and
 * `/api/CompContacts` because it was the only source for a contact's position
 * and fax — run together and merged, with the two secondary calls allowed to
 * fail so that a company with no address still beat an error page.
 *
 * `/api/Companies/{id}/full` returns all of it, plus the annual-report and
 * extended-boilerplate fields that previously came only from the LIST
 * projection and so were missing from the editor entirely unless the list had
 * been synced first. There is no partial-failure case left to handle: the
 * request either answers or it does not.
 *
 * A company edited locally short-circuits all of it: the local copy is what the
 * editor must open, and fetching would only risk overwriting it.
 */
export async function loadCompanyRecord(
  id: number,
  signal?: AbortSignal
): Promise<CompanyFull | null> {
  if (isCompanyEdited(id)) {
    const local = loadCompany(id)
    if (local) return local
  }

  try {
    return cacheCompany(mapCompanyFull(await fetchCompanyFull(id, signal)))
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    // Unreachable or unknown to the wire: a local draft is the remaining answer.
    return loadCompany(id)
  }
}

// ── Press releases ──────────────────────────────────────────────────────────

/**
 * A release list also carries the names of the companies credited on it.
 *
 * A `PressRelease` holds only `company_ids`, and the list page shows names. The
 * API sends the name inline on each row, so it comes back alongside the records
 * rather than being looked up in the local company cache, which would be empty
 * for anyone who went straight to the releases list.
 */
export interface ArticleListResult extends CachedListResult<PressRelease> {
  companyNames: Map<number, string>
  /** The page these records came from, echoed back so the UI can label it. */
  page: number
  /** Whether there is another page after this one. */
  hasMore: boolean
}

/**
 * A total is worth caching far longer than a page.
 *
 * A day. The count moves by a handful of releases a day, while discovering it
 * costs a chain of round trips — so a total that is a few hours behind is fine,
 * and refining it hourly would not be.
 */
export const TOTAL_STALE_AFTER = 24 * 60 * 60 * 1000

/**
 * One row per request. With `Size=1` the page number *is* the row index, so the
 * total is simply the last page number that still returns a row.
 *
 * Measured, the server costs ~1.15s for a deep page whether it returns 1 row or
 * 100 — the time goes on scanning to the offset, not on serialising the result.
 * So asking for a single row is the same latency for 477 bytes instead of 48 KB.
 */
const PROBE_SIZE = 1

/**
 * How many probes to run at once while searching for the end.
 *
 * The same measurement showed 10 concurrent probes completing in 1.97s against
 * ~11.5s sequentially: the latency is server think-time, so it overlaps almost
 * perfectly. A round of `k` probes narrows the window by a factor of `k + 1`,
 * so rounds cost `log(k+1)` and requests cost `k · log(k+1)` — which means
 * raising `k` buys wall-clock at a steadily worse price in requests:
 *
 *     k=1 (plain bisection)   ~17 rounds   ~17 requests   ~20s
 *     k=4                      ~7 rounds   ~28 requests    ~8s
 *     k=16                     ~4 rounds   ~64 requests    ~5s
 *
 * Four is the knee. Measured end-to-end against the live wire it counts 78,874
 * releases in 39 requests and ~24s — the overlap is worse in practice than the
 * shallow-page benchmark predicts, because concurrent deep-offset scans contend
 * server-side. That is the real cost, and it is acceptable only because the
 * answer is cached for a day and discovered in the background: the list renders
 * immediately and the footer fills the total in when it arrives.
 */
const PROBE_CONCURRENCY = 4

/**
 * The bracketing round steps in powers of four, not two.
 *
 * Nine probes instead of eighteen to cover the same range, at the cost of a
 * starting window four times wider — which the narrowing rounds absorb in well
 * under the nine requests saved. 4^9 is ~262,000 releases.
 */
const BRACKET_BASE = 4
const BRACKET_STEPS = 9

/**
 * The last index that still has a row, given a monotonic `hasRow`.
 *
 * Monotonic is the property that makes this work: rows exist continuously up to
 * the total and never after it, so any probe that finds a row raises the floor
 * and any probe that doesn't lowers the ceiling — which means a whole round of
 * probes can be read together instead of one at a time.
 */
async function findLastRow(
  hasRow: (index: number) => Promise<boolean>,
  seed: number | null
): Promise<number> {
  let low = 1
  let high = Infinity

  const absorb = (results: { index: number; has: boolean }[]) => {
    for (const { index, has } of results) {
      if (has) low = Math.max(low, index)
      else high = Math.min(high, index)
    }
  }

  const probe = (indexes: number[]) =>
    Promise.all(indexes.map(async index => ({ index, has: await hasRow(index) })))

  // Start from the last known answer: if it is still the end, this round
  // settles it and nothing else runs.
  if (seed !== null && seed > 1) {
    absorb(await probe([seed, seed + 1]))
    if (low === seed && high === seed + 1) return seed
  }

  // Bracket the answer. One round, every power of BRACKET_BASE at once.
  if (high === Infinity) {
    const powers = Array.from({ length: BRACKET_STEPS }, (_, i) => BRACKET_BASE ** (i + 1))
    absorb(await probe(powers.filter(p => p > low)))
    // Nothing came back empty: the collection is bigger than we can bracket.
    // `low` is the deepest row actually confirmed, which is the honest answer.
    if (high === Infinity) return low
  }

  // Narrow, a round at a time, until the remaining window fits in one round.
  while (high - low > 1) {
    const width = high - low

    if (width - 1 <= PROBE_CONCURRENCY) {
      absorb(await probe(Array.from({ length: width - 1 }, (_, i) => low + 1 + i)))
      break
    }

    const step = Math.floor(width / (PROBE_CONCURRENCY + 1))
    absorb(await probe(Array.from({ length: PROBE_CONCURRENCY }, (_, i) => low + step * (i + 1))))
  }

  return low
}

/**
 * How many releases the wire holds — 78,874 at the time of writing.
 *
 * The API publishes no count, so it is discovered by probing for the end of the
 * collection — ~39 requests and ~24s from cold, then two requests a day to
 * confirm it hasn't moved. It is a separate query from the page load for that
 * reason: nothing waits on it.
 *
 * Returns null when the wire can't be reached and nothing is cached — the UI
 * then shows the page number alone rather than a made-up total.
 */
export async function countArticles(
  { force = false, staleAfter = TOTAL_STALE_AFTER, signal }: LoadOptions = {}
): Promise<number | null> {
  const key = cacheKeys.articleTotal
  const cached = await cacheGet<number>(key)
  if (!force && cached && !isStale(cached, staleAfter)) return cached.value

  const hasRow = async (index: number) =>
    (await fetchArticles({ page: index, size: PROBE_SIZE }, signal)).length > 0

  try {
    // An empty collection has no end to search for.
    if (!(await hasRow(1))) {
      await cacheSet(key, 0)
      return 0
    }

    const total = await findLastRow(hasRow, cached?.value ?? null)
    await cacheSet(key, total)
    return total
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return cached?.value ?? null
  }
}

/**
 * One page of releases, plus every release that exists only here.
 *
 * Paged rather than exhaustive — 78,874 releases — and cache-first per page, so
 * paging back to somewhere already visited costs nothing. Local-only drafts are
 * folded into every page so they cannot be paged away from.
 */
export async function loadArticlePage(
  { page = 1, size = MAX_PAGE_SIZE }: PageParams = {},
  { force = false, staleAfter = DEFAULT_STALE_AFTER, signal }: LoadOptions = {}
): Promise<ArticleListResult> {
  const local = loadArticles()
  const pageSize = Math.min(size, MAX_PAGE_SIZE)
  const key = cacheKeys.articlePage(page, pageSize)
  const cached = force ? null : await cacheGet<PressRelease[]>(key)

  const assemble = (
    wire: PressRelease[],
    names: Map<number, string>,
    origin: ListOrigin,
    syncedAt: number | null,
    error: ApiError | null = null
  ): ArticleListResult => {
    const fromApi = overlayLocalEdits(wire, local)
    const apiIds = new Set(fromApi.map(a => a.id))
    // A locally created draft has no company on the wire to name it.
    for (const company of loadCompanies()) {
      if (!names.has(company.id)) names.set(company.id, company.name_en)
    }
    return {
      records: [...fromApi, ...localExtras(local, apiIds)],
      fromApi: fromApi.length,
      companyNames: names,
      page,
      hasMore: wire.length === pageSize,
      total: null,
      origin,
      syncedAt,
      error,
    }
  }

  if (cached && !isStale(cached, staleAfter)) {
    // Company names were resolved from the wire rows, which aren't cached
    // alongside the records. The releases carry their company ids, and the
    // local company cache names whatever it can.
    return assemble(cached.value, new Map(), 'cache', cached.savedAt)
  }

  try {
    const rows = await fetchArticles({ page, size: pageSize }, signal)
    const wire = rows.map(mapArticleListItem)
    await cacheSet(key, wire)
    // Also cached individually: this is what gives the editor its language hint.
    cacheArticles(wire)
    return assemble(wire, companyNamesFromRows(rows), 'network', Date.now())
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    const error = err instanceof ApiError ? err : new ApiError(0, '', String(err))

    if (cached) return assemble(cached.value, new Map(), 'cache', cached.savedAt, error)

    return {
      records: local,
      fromApi: 0,
      companyNames: new Map(loadCompanies().map(c => [c.id, c.name_en])),
      page,
      hasMore: false,
      total: null,
      origin: 'local',
      syncedAt: null,
      error,
    }
  }
}

/**
 * One full release.
 *
 * The detail endpoint carries the body but not the language, and the list row
 * carries the language but not the body, so the language is threaded in from
 * whatever the list already cached for this release rather than fetched again.
 */
export async function loadArticleRecord(
  id: number,
  signal?: AbortSignal
): Promise<PressRelease | null> {
  const cached = loadArticle(id)
  if (isArticleEdited(id) && cached) return cached

  try {
    const api = await fetchPressRelease(id, signal)
    // The cached list row is the only place the language tag survives.
    const language = cached?.languages[0] ?? null
    return cacheArticle(mapPressRelease(api, { language }))
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return cached
  }
}

// ── Events ──────────────────────────────────────────────────────────────────

/**
 * Every event on the wire, plus which of them the wire marks unpublished.
 *
 * TWO sources, deliberately, because neither alone is both complete and clean:
 *
 *   · `GET /api/Events/full` — the reconciled shape. 816 rows in ONE request
 *     and 286KB: real `+08:00` offsets, absolute urls and images, organisers
 *     deduped server-side. But it is PUBLISHED-ONLY.
 *   · `GET /api/Events` — the legacy sweep. All 839 rows across nine pages and
 *     2.65MB, with the organiser repeated once per release it has (167 copies
 *     on the worst row). It is the only place the 23 unpublished events exist.
 *
 * This is an admin panel, and the 23 unpublished events are exactly the ones
 * someone would come here to publish. Dropping them to take the cheaper call
 * would hide the work. So /full supplies the 816 it knows — it is authoritative
 * wherever the two overlap — and the legacy sweep contributes only the rows
 * /full does not have. The public site (newsroom-main) has no such constraint
 * and reads /full alone.
 *
 * Either source may fail on its own. Losing /full falls back to the legacy
 * mapping for everything; losing the sweep still lists the 816 published
 * events, with the unpublished ones simply absent rather than the page erroring.
 *
 * `unpublishedIds` rides along rather than having a loader of its own.
 * `isPublished` is not on the published `Event` contract, so it cannot travel
 * on the record — but it comes off the same rows already in hand.
 *
 * Events carry no local-edit overlay: writing is benched (see lib/events/write.ts),
 * so there are no local events for one to apply to.
 */
export interface EventListResult extends CachedListResult<Event> {
  /** Event ids the wire marks unpublished — 23 of 839 on the dev host. */
  unpublishedIds: Set<number>
}

/** What goes in the cache: the records, plus the flag that isn't on them. */
interface CachedEvents {
  events: Event[]
  unpublished: number[]
}

/**
 * How many rows to ask /api/Events/full for.
 *
 * Unlike `Size` on /api/Companies, which 400s above 100, `PageSize` here is
 * uncapped — 2000 returns the whole published set (816 at the last count) in
 * one request. Deliberately well clear of that figure so the archive can grow
 * without this silently truncating.
 */
const EVENTS_FULL_PAGE_SIZE = 2000

export async function loadAllEvents(
  { force = false, staleAfter = DEFAULT_STALE_AFTER, signal }: LoadOptions = {}
): Promise<EventListResult> {
  const cached = force ? null : await cacheGet<CachedEvents>(cacheKeys.allEvents)

  const assemble = (
    value: CachedEvents,
    origin: ListOrigin,
    syncedAt: number | null,
    error: ApiError | null = null
  ): EventListResult => ({
    records: value.events,
    fromApi: value.events.length,
    total: value.events.length,
    unpublishedIds: new Set(value.unpublished),
    origin,
    syncedAt,
    error,
  })

  if (cached && !isStale(cached, staleAfter)) {
    return assemble(cached.value, 'cache', cached.savedAt)
  }

  try {
    // Both in flight together; each is allowed to fail without the other.
    // `PageSize` is not capped on /full, so 2000 clears the 816 rows in one go.
    const [fullRows, legacyRows] = await Promise.all([
      fetchEventsFull({ pageNumber: 1, pageSize: EVENTS_FULL_PAGE_SIZE }, signal).catch(
        () => null
      ),
      pageThrough(
        (page, size) => fetchEvents({ pageNumber: page, pageSize: size }, signal),
        signal
      ).catch(() => null),
    ])

    // Nothing answered at all - fall through to the cache, as before.
    if (!fullRows && !legacyRows) throw new ApiError(0, '', 'Both event endpoints failed')

    const events: Event[] = (fullRows ?? []).map(mapEventFull)
    const fromFull = new Set(events.map(event => event.id))

    // The legacy sweep contributes ONLY what /full does not have. When /full
    // itself is missing, that is every row, and this degrades to the old
    // behaviour rather than to an empty list.
    const unpublished: number[] = []
    for (const row of legacyRows ?? []) {
      if (!isPublished(row)) unpublished.push(row.id)
      if (!fromFull.has(row.id)) events.push(mapEvent(row))
    }

    const value: CachedEvents = { events, unpublished }
    await cacheSet(cacheKeys.allEvents, value)
    return assemble(value, 'network', Date.now())
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    const error = err instanceof ApiError ? err : new ApiError(0, '', String(err))
    if (cached) return assemble(cached.value, 'cache', cached.savedAt, error)
    return {
      records: [],
      fromApi: 0,
      total: null,
      unpublishedIds: new Set(),
      origin: 'local',
      syncedAt: null,
      error,
    }
  }
}

/**
 * One event.
 *
 * There IS a detail endpoint now: `GET /api/Events/{id}/full`. Note the fix
 * landed there and not on `/api/Events/{id}`, which still answers the same 500
 * it has since 2026-09-07 — so this reads the /full route, never that one.
 *
 * Three steps, cheapest first:
 *
 *  1. A fresh cached set already holds every event, published or not. Opening
 *     one from it costs nothing, so no request is made at all.
 *  2. Cold start: the /full detail route is one small request, against the
 *     nine-page sweep `loadAllEvents` would otherwise have to run just to read
 *     a single row.
 *  3. A 404 from step 2 is not necessarily a missing event — /full is
 *     published-only, so the 23 unpublished ones answer 404 there and exist
 *     only in the legacy sweep. Falling through to `loadAllEvents` is what
 *     keeps them openable by URL.
 */
export async function loadEventRecord(
  id: number,
  options: LoadOptions = {}
): Promise<Event | null> {
  const { force = false, staleAfter = DEFAULT_STALE_AFTER, signal } = options

  const cached = force ? null : await cacheGet<CachedEvents>(cacheKeys.allEvents)
  if (cached && !isStale(cached, staleAfter)) {
    return cached.value.events.find(event => event.id === id) ?? null
  }

  try {
    return mapEventFull(await fetchEventFull(id, signal))
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    // Unpublished, unknown, or the route is down. The sweep can still answer.
  }

  const { records } = await loadAllEvents(options)
  return records.find(event => event.id === id) ?? null
}

/**
 * The releases filed against an event.
 *
 * Needs the organiser and the year, which is why this takes an `Event` rather
 * than an id: both come off the record, and an event missing either has no feed
 * to load. Returns an empty list for those — 718 of 839 events have no `compId`
 * at all — rather than treating it as an error, because having no releases is
 * the normal case rather than a failure.
 */
export async function loadEventReleases(
  event: Event | null,
  { force = false, staleAfter = DEFAULT_STALE_AFTER, signal }: LoadOptions = {}
): Promise<EventRelease[]> {
  const year = event ? eventYear(event) : null
  if (!event || event.compId === null || year === null) return []

  const key = cacheKeys.eventReleases(event.compId, year)
  const cached = force ? null : await cacheGet<EventRelease[]>(key)
  if (cached && !isStale(cached, staleAfter)) return cached.value

  try {
    const rows = await fetchEventReleases(event.compId, year, signal)
    const releases = rows.map(mapEventRelease)
    await cacheSet(key, releases)
    return releases
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return cached?.value ?? []
  }
}
