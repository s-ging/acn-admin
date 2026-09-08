/**
 * Cache-first behaviour, and the total-count discovery.
 *
 * jsdom provides no IndexedDB, so ./cache is mocked with an in-memory Map
 * rather than left to no-op — the point of these tests is the repository's
 * cache-first logic, which is invisible when every cache read returns null.
 * `savedAt` is settable so staleness can be tested without waiting an hour.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { ApiArticleListItem, ApiCompanyListItem } from './types'

/** The fake store, shared with the mock below. Reset per test. */
const store = new Map<string, { value: unknown; savedAt: number }>()

vi.mock('./cache', async () => {
  const actual = await vi.importActual<typeof import('./cache')>('./cache')
  return {
    ...actual,
    cacheGet: vi.fn(async (key: string) => store.get(key) ?? null),
    cacheSet: vi.fn(async (key: string, value: unknown) => {
      store.set(key, { value, savedAt: Date.now() })
    }),
    cacheDelete: vi.fn(async (key: string) => { store.delete(key) }),
    cacheDeletePrefix: vi.fn(async (prefix: string) => {
      for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key)
    }),
  }
})

const { countArticles, loadAllCompanies, loadArticlePage, DEFAULT_STALE_AFTER, TOTAL_STALE_AFTER } =
  await import('./repository')
const { cacheKeys } = await import('./cache')

const PAGE_SIZE = 100

function apiCompany(id: number): ApiCompanyListItem {
  return {
    companyId: id, companyNameEN: `Company ${id}`,
    companyNameCH: null, companyNameCT: null, companyNameJP: null, companyNameKO: null,
    logoFilename: null, topLogoFilename: null, boilerPlate: null, extBoilerPlate: null,
    reportFilename: null, reportFileDate: null, reportFileSize: null,
    username: null, password: null, url: null,
  }
}

function apiArticle(id: number): ApiArticleListItem {
  return {
    articleId: id, headline: `Release ${id}`, publishDate: '2026-01-01T00:00:00',
    summary: null, hasImage: false, imageUrl: null, language: 'EN',
    companies: [{ companyId: 1, companyName: 'Co', logoFilename: null }], images: [],
  }
}

/** A fake wire holding `total` records, counting every request it serves. */
function stubWire(options: { companies?: number; articles?: number }) {
  const requests: string[] = []

  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    // The client now emits a same-origin path (/wire/api/...) in a browser-like
    // environment, so this needs a base to resolve against and has to match on
    // the tail of the path rather than the whole of it. Resolving here rather
    // than pinning an absolute base in the client keeps the tests exercising the
    // same URL construction the app uses.
    const url = new URL(String(input), 'http://test.local')
    requests.push(url.pathname + url.search)

    const isCompanies = url.pathname.endsWith('/api/Companies')
    const total = (isCompanies ? options.companies : options.articles) ?? 0
    const page = Number(url.searchParams.get('Page') ?? 1)
    const size = Number(url.searchParams.get('Size') ?? PAGE_SIZE)

    const start = (page - 1) * size
    const ids = Array.from(
      { length: Math.max(0, Math.min(size, total - start)) },
      (_, i) => start + i + 1
    )
    const rows = isCompanies ? ids.map(apiCompany) : ids.map(apiArticle)
    return new Response(JSON.stringify(rows), { status: 200 })
  }))

  return { requests }
}

function stubOffline() {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
}

beforeEach(() => {
  store.clear()
  localStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('cache-first companies', () => {
  it('goes to the wire when nothing is cached, then caches it', async () => {
    const { requests } = stubWire({ companies: 250 })
    const result = await loadAllCompanies()

    expect(result.origin).toBe('network')
    expect(result.records).toHaveLength(250)
    expect(result.total).toBe(250)
    expect(requests.length).toBeGreaterThan(0)
    expect(store.has(cacheKeys.allCompanies)).toBe(true)
  })

  it('serves a second load entirely from the cache, hitting the wire zero times', async () => {
    // This is the whole point of the cache: navigating back to the list must not
    // cost another 95 requests.
    stubWire({ companies: 250 })
    await loadAllCompanies()

    const { requests } = stubWire({ companies: 250 })
    const result = await loadAllCompanies()

    expect(result.origin).toBe('cache')
    expect(result.records).toHaveLength(250)
    expect(requests).toHaveLength(0)
  })

  it('re-syncs once the cached copy is older than the staleness window', async () => {
    stubWire({ companies: 100 })
    await loadAllCompanies()

    // Backdate the entry past the window.
    const entry = store.get(cacheKeys.allCompanies)!
    entry.savedAt = Date.now() - DEFAULT_STALE_AFTER - 1

    const { requests } = stubWire({ companies: 100 })
    const result = await loadAllCompanies()

    expect(result.origin).toBe('network')
    expect(requests.length).toBeGreaterThan(0)
  })

  it('force ignores a fresh cache', async () => {
    stubWire({ companies: 100 })
    await loadAllCompanies()

    const { requests } = stubWire({ companies: 100 })
    const result = await loadAllCompanies({ force: true })

    expect(result.origin).toBe('network')
    expect(requests.length).toBeGreaterThan(0)
  })

  it('falls back to the cache when the wire is unreachable', async () => {
    stubWire({ companies: 250 })
    await loadAllCompanies()

    // Offline, and the cache is stale — it should still be served, because
    // every company is better than none. This is the "reconvene when back
    // online" half of the arrangement.
    store.get(cacheKeys.allCompanies)!.savedAt = Date.now() - DEFAULT_STALE_AFTER - 1
    stubOffline()
    const result = await loadAllCompanies()

    expect(result.origin).toBe('cache')
    expect(result.records).toHaveLength(250)
    // The error is reported alongside the data, not instead of it.
    expect(result.error).not.toBeNull()
  })

  it('reports local-only when offline with nothing cached', async () => {
    stubOffline()
    const result = await loadAllCompanies()

    expect(result.origin).toBe('local')
    expect(result.records).toEqual([])
    expect(result.error).not.toBeNull()
  })

  it('caches the wire’s copy, not the locally edited one', async () => {
    const { saveCompany } = await import('../companies/storage')
    const { blankCompany } = await import('../companies/blank')

    stubWire({ companies: 10 })
    await loadAllCompanies()

    // Edit company 5 after the sync.
    saveCompany({ ...blankCompany(5, 'Renamed'), created_at: '' })

    const cached = store.get(cacheKeys.allCompanies)!.value as { id: number; name_en: string }[]
    expect(cached.find(c => c.id === 5)?.name_en).toBe('Company 5')

    // ...but the list still shows the edit, because the overlay happens on read.
    stubWire({ companies: 10 })
    const result = await loadAllCompanies()
    expect(result.origin).toBe('cache')
    expect(result.records.find(c => c.id === 5)?.name_en).toBe('Renamed')
  })
})

describe('cache-first article pages', () => {
  it('caches each page separately and re-serves it without a request', async () => {
    stubWire({ articles: 500 })
    await loadArticlePage({ page: 1, size: 50 })
    await loadArticlePage({ page: 2, size: 50 })

    const { requests } = stubWire({ articles: 500 })
    const page1 = await loadArticlePage({ page: 1, size: 50 })
    const page2 = await loadArticlePage({ page: 2, size: 50 })

    expect(page1.origin).toBe('cache')
    expect(page2.origin).toBe('cache')
    expect(requests).toHaveLength(0)
    // Still the right rows, and still no bleed between pages.
    expect(page1.records).toHaveLength(50)
    expect(page2.records).toHaveLength(50)
    const ids1 = new Set(page1.records.map(a => a.id))
    expect(page2.records.some(a => ids1.has(a.id))).toBe(false)
  })

  it('serves a cached page when offline', async () => {
    stubWire({ articles: 500 })
    await loadArticlePage({ page: 1, size: 50 })

    store.get(cacheKeys.articlePage(1, 50))!.savedAt = Date.now() - DEFAULT_STALE_AFTER - 1
    stubOffline()
    const result = await loadArticlePage({ page: 1, size: 50 })

    expect(result.origin).toBe('cache')
    expect(result.records).toHaveLength(50)
    expect(result.error).not.toBeNull()
  })
})

describe('countArticles', () => {
  it('finds the exact total the wire holds', async () => {
    stubWire({ articles: 78874 })
    expect(await countArticles()).toBe(78874)
  })

  it('does it in a logarithmic number of requests, not a linear one', async () => {
    const { requests } = stubWire({ articles: 78874 })
    await countArticles()
    // A powers-of-four bracket plus rounds of four narrowing probes lands
    // around 40 for a wire this deep. Walking 789 pages — let alone 78,874
    // rows — is what this must never degrade into.
    expect(requests.length).toBeLessThan(50)
    // Every probe asks for a single row.
    expect(requests.every(r => r.includes('Size=1'))).toBe(true)
  })

  it('confirms an unchanged total in two requests, using the cached answer', async () => {
    stubWire({ articles: 500 })
    await countArticles()

    // Age it past the window so it re-verifies rather than short-circuiting.
    store.get(cacheKeys.articleTotal)!.savedAt = Date.now() - TOTAL_STALE_AFTER - 1

    const { requests } = stubWire({ articles: 500 })
    expect(await countArticles()).toBe(500)
    // hasRow(1), hasRow(500), hasRow(501) — the seed made the search trivial.
    expect(requests.length).toBeLessThanOrEqual(3)
  })

  it('finds a total that has grown since it was cached', async () => {
    stubWire({ articles: 500 })
    await countArticles()
    store.get(cacheKeys.articleTotal)!.savedAt = Date.now() - TOTAL_STALE_AFTER - 1

    stubWire({ articles: 640 })
    expect(await countArticles()).toBe(640)
  })

  it('finds a total that has shrunk since it was cached', async () => {
    stubWire({ articles: 500 })
    await countArticles()
    store.get(cacheKeys.articleTotal)!.savedAt = Date.now() - TOTAL_STALE_AFTER - 1

    stubWire({ articles: 300 })
    expect(await countArticles()).toBe(300)
  })

  it('handles a total that lands exactly on a page boundary', async () => {
    stubWire({ articles: 500 })
    expect(await countArticles()).toBe(500)
  })

  it('handles a wire smaller than one display page', async () => {
    stubWire({ articles: 42 })
    expect(await countArticles()).toBe(42)
  })

  it('handles a wire holding exactly one release', async () => {
    stubWire({ articles: 1 })
    expect(await countArticles()).toBe(1)
  })

  it('handles an empty wire', async () => {
    stubWire({ articles: 0 })
    expect(await countArticles()).toBe(0)
  })

  it('is cached, so asking twice costs one discovery', async () => {
    stubWire({ articles: 500 })
    await countArticles()

    const { requests } = stubWire({ articles: 500 })
    expect(await countArticles()).toBe(500)
    expect(requests).toHaveLength(0)
  })

  it('returns null when offline with nothing cached, rather than a made-up number', async () => {
    stubOffline()
    expect(await countArticles()).toBeNull()
  })

  it('returns the cached total when offline', async () => {
    stubWire({ articles: 500 })
    await countArticles()

    store.get(cacheKeys.articleTotal)!.savedAt = Date.now() - DEFAULT_STALE_AFTER - 1
    stubOffline()
    expect(await countArticles()).toBe(500)
  })
})
