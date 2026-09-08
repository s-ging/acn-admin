/**
 * Where requests are addressed.
 *
 * jsdom, because the browser branch is the one that matters: it is what got the
 * deployed app blocked, and the whole point of the proxy is that this resolves
 * to a same-origin path rather than the API's hostname.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  API_PROXY_PREFIX,
  API_UPSTREAM_URL,
  ApiError,
  apiGet,
  getApiBaseUrl,
  setApiBaseUrl,
} from './client'

/** Records the URL a call was addressed to, and answers with `[]`. */
function captureUrl(): { urls: string[] } {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    urls.push(String(input))
    return new Response('[]', { status: 200 })
  }))
  return { urls }
}

afterEach(() => {
  vi.unstubAllGlobals()
  // The module holds the base in a mutable binding; put it back.
  setApiBaseUrl(API_PROXY_PREFIX)
})

describe('base URL', () => {
  it('addresses the same-origin proxy in a browser, not the API hostname', () => {
    // The regression this guards: a direct cross-origin call is blocked from
    // every origin the API has not been told about, which included the
    // deployment. Same-origin has no CORS to fail.
    expect(getApiBaseUrl()).toBe(API_PROXY_PREFIX)
    expect(getApiBaseUrl()).not.toContain('acnnewswire.com')
  })

  it('builds a relative path that the proxy will forward', async () => {
    const { urls } = captureUrl()
    await apiGet('/api/Companies', { Page: 1, Size: 100 })
    // /wire/api/Companies → upstream /api/Companies, per vercel.json and
    // vite.config.ts.
    expect(urls[0]).toBe('/wire/api/Companies?Page=1&Size=100')
  })

  it('names the upstream in one place, shared with the two proxy configs', () => {
    expect(API_UPSTREAM_URL).toBe('https://development.acnnewswire.com')
  })

  it('can be pointed elsewhere for scripts, and trailing slashes do not double up', async () => {
    setApiBaseUrl('https://example.test/')
    const { urls } = captureUrl()
    await apiGet('/api/Companies')
    expect(urls[0]).toBe('https://example.test/api/Companies')
  })
})

describe('query building', () => {
  it('omits empty params rather than sending a blank value', async () => {
    // Several endpoints validate their query string and reject a blank where
    // they would have accepted an absent one.
    const { urls } = captureUrl()
    await apiGet('/api/Companies', { Page: 1, Size: undefined, Sort1: '', Ord1: null })
    expect(urls[0]).toBe('/wire/api/Companies?Page=1')
  })

  it('keeps a legitimate false', async () => {
    const { urls } = captureUrl()
    await apiGet('/api/Articles/homepage', { hasThumbnail: false })
    expect(urls[0]).toContain('hasThumbnail=false')
  })
})

describe('failures', () => {
  it('reports an unreachable API as a status-0 ApiError', async () => {
    // What a blocked CORS response and a dead network both look like from
    // fetch: a rejected promise with no status of its own.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(apiGet('/api/Companies')).rejects.toBeInstanceOf(ApiError)
    await expect(apiGet('/api/Companies')).rejects.toMatchObject({ status: 0 })
  })

  it('marks a 404 as not found, and a 5xx as neither', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    const notFound = await apiGet('/api/Events/1').catch((e: ApiError) => e)
    expect((notFound as ApiError).isNotFound).toBe(true)

    // 522 is what Cloudflare returns when it cannot reach the API's origin —
    // seen in practice, and it must not read as "no such record".
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 522 })))
    const down = await apiGet('/api/Events/1').catch((e: ApiError) => e)
    expect((down as ApiError).status).toBe(522)
    expect((down as ApiError).isNotFound).toBe(false)
  })

  it('reads an empty 200 body as an empty list', async () => {
    // Some endpoints answer 200 with nothing at all.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('   ', { status: 200 })))
    await expect(apiGet('/api/Articles/homepage')).resolves.toEqual([])
  })

  it('rejects a non-JSON 200 rather than returning junk', async () => {
    // A proxy misconfiguration serves the SPA's index.html here, which would
    // otherwise be parsed as data.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><html>', { status: 200 })))
    await expect(apiGet('/api/Companies')).rejects.toBeInstanceOf(ApiError)
  })
})
