// src/hooks/useRecords.ts
// React Query bindings over lib/api/repository.
//
// The provider was already in main.tsx waiting for something to use it.
//
// There are two layers of caching and they answer different questions:
//
//   React Query — in memory, per session. Stops a re-render or a navigation
//                 re-running a load at all.
//   IndexedDB   — on disk, across sessions. Stops a load hitting the wire.
//                 Lives in lib/api/cache.ts; the repository reads it.
//
// So `staleTime` here is deliberately long: the repository is already
// cache-first, and the API is read-only, so nothing this app does can change
// what the wire says. `retry: 1` because the repository falls back to the cache
// on failure — a longer retry chain just delays a list that has data to show.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  countArticles,
  loadAllCompanies,
  loadAllEvents,
  loadArticlePage,
  loadArticleRecord,
  loadCompanyRecord,
  loadEventReleases,
} from '../lib/api/repository'
import { ARTICLE_PAGE_PREFIX, cacheDelete, cacheDeletePrefix, cacheKeys } from '../lib/api/cache'
import type { PageParams } from '../lib/api/repository'

/** Five minutes in memory. The on-disk window is the repository's hour. */
const STALE_TIME = 5 * 60 * 1000

export const recordKeys = {
  companies: () => ['companies', 'all'] as const,
  company: (id: number | null) => ['company', id] as const,
  articles: (params: PageParams) => ['articles', params] as const,
  articleTotal: () => ['articles', 'total'] as const,
  article: (id: number | null) => ['article', id] as const,
  events: () => ['events', 'all'] as const,
  eventReleases: (compId: number | null, year: number | null) =>
    ['events', 'releases', compId, year] as const,
}

/**
 * Every company on the wire — all 9,439 — served from IndexedDB when possible.
 *
 * One query rather than a paged one so the list's search, filters and A–Z index
 * work over the whole set. The cost is a ~95-request sync once an hour, and
 * nothing at all in between; paging the fetch instead would mean a request per
 * click and filters that only see 100 rows.
 */
export function useAllCompanies() {
  return useQuery({
    queryKey: recordKeys.companies(),
    queryFn: ({ signal }) => loadAllCompanies({ signal }),
    staleTime: STALE_TIME,
    retry: 1,
  })
}

export function useCompanyRecord(id: number | null) {
  return useQuery({
    queryKey: recordKeys.company(id),
    queryFn: ({ signal }) => loadCompanyRecord(id!, signal),
    enabled: id !== null,
    staleTime: STALE_TIME,
    retry: 1,
  })
}

/**
 * One page of releases. Paged, unlike companies: there are 78,874 of them.
 *
 * `placeholderData` keeps the previous page on screen while the next one loads,
 * so paging doesn't blank the table and shift the layout on every click.
 */
export function useArticlePage(params: PageParams = {}) {
  return useQuery({
    queryKey: recordKeys.articles(params),
    queryFn: ({ signal }) => loadArticlePage(params, { signal }),
    staleTime: STALE_TIME,
    retry: 1,
    placeholderData: previous => previous,
  })
}

/**
 * How many releases exist in total.
 *
 * Separate from the page query because discovering it costs ~10 requests (the
 * API publishes no count) and the answer changes far more slowly than a page
 * does. Cached on disk, so it is normally free.
 */
export function useArticleTotal() {
  return useQuery({
    queryKey: recordKeys.articleTotal(),
    queryFn: ({ signal }) => countArticles({ signal }),
    staleTime: STALE_TIME,
    retry: 1,
  })
}

export function useArticleRecord(id: number | null) {
  return useQuery({
    queryKey: recordKeys.article(id),
    queryFn: ({ signal }) => loadArticleRecord(id!, signal),
    enabled: id !== null,
    staleTime: STALE_TIME,
    retry: 1,
  })
}

/**
 * Every event on the wire — all 839.
 *
 * Fetched in full like companies, and for one extra reason: `/api/Events/{id}`
 * is broken server-side, so this cached set is the only way to open a single
 * event. `useEventRecord` reads out of it rather than fetching.
 */
export function useAllEvents() {
  return useQuery({
    queryKey: recordKeys.events(),
    queryFn: ({ signal }) => loadAllEvents({ signal }),
    staleTime: STALE_TIME,
    retry: 1,
  })
}

/** One event, out of the cached set. There is no detail endpoint to call. */
export function useEventRecord(id: number | null) {
  const query = useAllEvents()
  const event = id === null ? null : query.data?.records.find(e => e.id === id) ?? null

  return {
    ...query,
    event,
    /** True once the set has loaded and the id genuinely isn't in it. */
    notFound: id !== null && query.isFetched && !query.isLoading && !event,
  }
}

/**
 * The releases filed against an event.
 *
 * `enabled` is the load-bearing part: 718 of 839 events have no organiser id, so
 * for most of them there is nothing to request and the query must not run.
 */
export function useEventReleases(event: Parameters<typeof loadEventReleases>[0]) {
  const compId = event?.compId ?? null
  const year = event?.startDate ? Number(event.startDate.slice(0, 4)) : null

  return useQuery({
    queryKey: recordKeys.eventReleases(compId, year),
    queryFn: ({ signal }) => loadEventReleases(event, { signal }),
    enabled: compId !== null && year !== null,
    staleTime: STALE_TIME,
    retry: 1,
  })
}

/**
 * Forces a re-sync, bypassing both cache layers.
 *
 * What a "Refresh" control calls. `force` is passed down to the repository so
 * the on-disk cache is rewritten rather than read — invalidating the React
 * Query key alone would just re-serve the same IndexedDB entry.
 */
export function useRefreshRecords() {
  const client = useQueryClient()

  return useCallback(
    async (what: 'companies' | 'articles' | 'events') => {
      if (what === 'events') {
        await cacheDelete(cacheKeys.allEvents)
        await Promise.all([
          client.invalidateQueries({ queryKey: ['events'] }),
          client.fetchQuery({
            queryKey: recordKeys.events(),
            queryFn: ({ signal }) => loadAllEvents({ force: true, signal }),
          }),
        ])
        return
      }

      if (what === 'companies') {
        await client.fetchQuery({
          queryKey: recordKeys.companies(),
          queryFn: ({ signal }) => loadAllCompanies({ force: true, signal }),
        })
        return
      }

      // The on-disk entries have to go first. Invalidating the React Query key
      // alone would re-run the load, which would find the same IndexedDB entry
      // still fresh and hand it straight back.
      await cacheDeletePrefix(ARTICLE_PAGE_PREFIX)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['articles'] }),
        client.fetchQuery({
          queryKey: recordKeys.articleTotal(),
          queryFn: ({ signal }) => countArticles({ force: true, signal }),
        }),
      ])
    },
    [client]
  )
}
