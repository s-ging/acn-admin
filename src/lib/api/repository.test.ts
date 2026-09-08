/**
 * The repository touches localStorage, so it needs a real one — same reason
 * lib/sheet/commit.test.ts does.
 *
 * `fetch` is stubbed rather than hitting the wire: these tests are about the
 * paging and overlay rules, and the point of a stub is that it can serve an
 * exact number of rows and count how many requests were made, which the live
 * API cannot be asked to do.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadAllCompanies, loadArticlePage } from './repository'
import { saveCompany } from '../companies/storage'
import { saveArticle } from '../press-releases/storage'
import { blankCompany } from '../companies/blank'
import { createArticle } from '../press-releases/normalize'
import type { ApiArticleListItem, ApiCompanyListItem } from './types'

const PAGE_SIZE = 100

function apiCompany(id: number): ApiCompanyListItem {
  return {
    companyId: id,
    companyNameEN: `Wire Company ${id}`,
    companyNameCH: null, companyNameCT: null, companyNameJP: null, companyNameKO: null,
    logoFilename: null, topLogoFilename: null,
    boilerPlate: null, extBoilerPlate: null,
    reportFilename: null, reportFileDate: null, reportFileSize: null,
    username: null, password: null, url: null,
  }
}

function apiArticle(id: number): ApiArticleListItem {
  return {
    articleId: id,
    headline: `Wire release ${id}`,
    publishDate: '2026-01-01T00:00:00',
    summary: null,
    hasImage: false, imageUrl: null,
    language: 'EN',
    companies: [{ companyId: 500, companyName: 'Wire Co', logoFilename: null }],
    images: [],
  }
}

/**
 * A fake wire holding `total` records, paged the way the real one is: `Size`
 * rows per `Page`, and a short page at the end as the only end-of-data signal.
 */
function stubWire(options: { companies?: number; articles?: number }) {
  const requests: string[] = []

  const handler = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input))
    requests.push(url.pathname + url.search)

    const isCompanies = url.pathname === '/api/Companies'
    const total = (isCompanies ? options.companies : options.articles) ?? 0
    const page = Number(url.searchParams.get('Page') ?? 1)
    const size = Number(url.searchParams.get('Size') ?? PAGE_SIZE)

    const start = (page - 1) * size
    const ids = Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, i) => start + i + 1)
    const rows = isCompanies ? ids.map(apiCompany) : ids.map(apiArticle)

    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  vi.stubGlobal('fetch', handler)
  return { requests }
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('loadAllCompanies', () => {
  it('pages through every company, not just the first page', () => {
    // The whole reason this exists: the wire holds ~9,400 companies and the
    // server caps a page at 100, so one request returns 1% of the set.
    stubWire({ companies: 9439 })
    return loadAllCompanies().then(result => {
      expect(result.records).toHaveLength(9439)
      expect(result.fromApi).toBe(9439)
      expect(result.error).toBeNull()
      expect(new Set(result.records.map(c => c.id)).size).toBe(9439)
    })
  })

  it('stops at the short page rather than requesting forever', async () => {
    const { requests } = stubWire({ companies: 250 })
    await loadAllCompanies()
    // 250 records is three pages. The batch of 8 that contains the short page
    // is allowed to complete, but nothing beyond it is requested.
    expect(requests.length).toBeLessThanOrEqual(8)
    expect(requests.length).toBeGreaterThanOrEqual(3)
  })

  it('handles a total that divides exactly by the page size', async () => {
    stubWire({ companies: 200 })
    const result = await loadAllCompanies()
    expect(result.records).toHaveLength(200)
  })

  it('handles an empty wire', async () => {
    stubWire({ companies: 0 })
    const result = await loadAllCompanies()
    expect(result.records).toEqual([])
    expect(result.error).toBeNull()
  })

  it('shows a locally created company alongside the wire’s', async () => {
    stubWire({ companies: 100 })
    saveCompany(blankCompany(999999, 'My New Company'))

    const result = await loadAllCompanies()
    expect(result.records).toHaveLength(101)
    expect(result.fromApi).toBe(100)
    expect(result.records.some(c => c.id === 999999)).toBe(true)
  })

  it('shows a locally edited wire company with its edit, not the wire’s copy', async () => {
    stubWire({ companies: 100 })
    // Company 5 exists on the wire as "Wire Company 5". Edit it here.
    const edited = { ...blankCompany(5, 'Renamed Locally'), created_at: '' }
    saveCompany(edited)

    const result = await loadAllCompanies()
    // Overlaid in place, not appended: still 100 records.
    expect(result.records).toHaveLength(100)
    expect(result.records.find(c => c.id === 5)?.name_en).toBe('Renamed Locally')
  })

  it('falls back to local records when the wire is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    saveCompany(blankCompany(999999, 'My New Company'))

    const result = await loadAllCompanies()
    expect(result.error).not.toBeNull()
    expect(result.fromApi).toBe(0)
    expect(result.records.some(c => c.id === 999999)).toBe(true)
  })
})

describe('loadArticlePage', () => {
  it('returns one page and reports that more follow', async () => {
    stubWire({ articles: 78874 })
    const result = await loadArticlePage({ page: 1, size: 50 })
    expect(result.records).toHaveLength(50)
    expect(result.page).toBe(1)
    expect(result.hasMore).toBe(true)
  })

  it('reports no more once the page comes back short', async () => {
    stubWire({ articles: 120 })
    const result = await loadArticlePage({ page: 2, size: 100 })
    expect(result.records).toHaveLength(20)
    expect(result.hasMore).toBe(false)
  })

  /**
   * The regression this file was written for.
   *
   * Releases are cached page by page as they are browsed, so once page one has
   * been visited its rows are sitting in localStorage. A "local extras" rule of
   * "anything the API response didn't mention" would fold all fifty of them
   * back into page two — and page three, and so on.
   */
  it('does not fold earlier pages back in as local records', async () => {
    stubWire({ articles: 500 })

    const page1 = await loadArticlePage({ page: 1, size: 50 })
    const page2 = await loadArticlePage({ page: 2, size: 50 })
    const page3 = await loadArticlePage({ page: 3, size: 50 })

    expect(page1.records).toHaveLength(50)
    expect(page2.records).toHaveLength(50)
    expect(page3.records).toHaveLength(50)

    const ids1 = new Set(page1.records.map(a => a.id))
    expect(page2.records.some(a => ids1.has(a.id))).toBe(false)
    expect(page3.records.some(a => ids1.has(a.id))).toBe(false)
  })

  it('keeps a local draft on every page, since it belongs to no page', async () => {
    stubWire({ articles: 500 })
    const draft = createArticle(999999)
    saveArticle({ ...draft, headline: 'Local draft' })

    const page1 = await loadArticlePage({ page: 1, size: 50 })
    const page2 = await loadArticlePage({ page: 2, size: 50 })

    expect(page1.records).toHaveLength(51)
    expect(page2.records).toHaveLength(51)
    expect(page1.records.some(a => a.id === 999999)).toBe(true)
    expect(page2.records.some(a => a.id === 999999)).toBe(true)
  })

  it('carries the company names the rows arrive with', async () => {
    stubWire({ articles: 100 })
    const result = await loadArticlePage({ page: 1, size: 50 })
    expect(result.companyNames.get(500)).toBe('Wire Co')
  })

  it('caps the requested size at the server’s limit of 100', async () => {
    const { requests } = stubWire({ articles: 500 })
    await loadArticlePage({ page: 1, size: 5000 })
    expect(requests[0]).toContain('Size=100')
  })
})
