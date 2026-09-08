// src/lib/api/client.ts
// The one place that talks to the ACN Newswire API.
//
// Spec: https://development.acnnewswire.com/swagger/index.html
//
// Two things about that spec shape everything in this folder:
//
//   1. Every operation is a GET. There is no POST/PUT/PATCH/DELETE for
//      companies, articles or events, so the API is a *read* source only.
//      Editing still goes to localStorage — see lib/companies/storage.ts.
//   2. None of the 200 responses declare a schema, so the types in ./types.ts
//      are hand-written from the live responses rather than generated. Treat
//      them as a best-effort record of what the server actually sends.
//
// And one thing about the *transport*: requests do not go to the API's hostname
// from the browser. They go to this origin's /wire path, which the dev server
// and the deployment both proxy upstream. The API's CORS is an allowlist, so a
// direct call works from one whitelisted localhost port and nowhere else. See
// `resolveBaseUrl`.

/**
 * The wire itself. Only ever called directly from Node — see `resolveBaseUrl`.
 *
 * Kept in step with the `/wire` proxy target in vite.config.ts and the rewrite
 * destination in vercel.json. All three name the same upstream.
 */
const UPSTREAM_URL = 'https://development.acnnewswire.com'

/**
 * The same-origin path that proxies to the wire.
 *
 * Configured in two places, one per environment: `server.proxy` in
 * vite.config.ts for dev, and a `rewrites` entry in vercel.json for the
 * deployment. Both forward /wire/* to the upstream with the prefix stripped, so
 * /wire/api/Companies reaches /api/Companies.
 *
 * Not `/api`, deliberately: Vercel treats a top-level /api path as its
 * serverless functions directory, and a rewrite that collides with that
 * convention is a trap for whoever adds the first function.
 */
export const API_PROXY_PREFIX = '/wire'

/**
 * Where requests go.
 *
 * WHY A PROXY AT ALL: the API's CORS is an allowlist, not a wildcard. An origin
 * on the list gets an `access-control-allow-origin` header back; every other
 * origin gets none and the browser blocks the response. `http://localhost:5173`
 * is on it, `http://localhost:5174` is not, and neither is any deployed origin —
 * which is why the app worked locally and showed nothing once deployed.
 *
 * Asking for each new domain to be added upstream does not scale to preview
 * deployments, and it puts shipping behind someone else's config change. Going
 * through the app's own origin removes the question: the browser makes a
 * same-origin request, the server forwards it, and server-to-server traffic has
 * no CORS.
 *
 * Three cases, in order:
 *
 *   VITE_API_BASE_URL set — an explicit override wins. Note that pointing it
 *     straight at the wire re-introduces the CORS problem, so it is for a
 *     different proxy or a local mock, not for the upstream URL.
 *   in a browser — the proxy prefix, i.e. same-origin.
 *   in Node — the upstream directly. Tests and scripts have no proxy in front
 *     of them and no CORS to worry about.
 */
function resolveBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return API_PROXY_PREFIX
  return UPSTREAM_URL
}

let baseUrl: string = resolveBaseUrl()

export function getApiBaseUrl(): string {
  return baseUrl
}

/**
 * Points the client somewhere else at runtime.
 *
 * For scripts and one-off verification against the live wire, where there is no
 * proxy to go through. Application code should not need this.
 */
export function setApiBaseUrl(url: string): void {
  baseUrl = url.replace(/\/+$/, '')
}

/** The upstream, for anything that needs to name it (docs, diagnostics). */
export const API_UPSTREAM_URL = UPSTREAM_URL

/**
 * A failed call. Carries the status so callers can tell "no such record" (404)
 * from "the wire is down", which the editor pages need in order to decide
 * between falling back to a local draft and showing an error.
 */
export class ApiError extends Error {
  readonly status: number
  readonly url: string

  constructor(status: number, url: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.url = url
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

/** The spec declares a `Bearer` JWT scheme; the dev host serves reads without one. */
let authToken: string | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export type QueryValue = string | number | boolean | null | undefined

/**
 * Drops empty params rather than sending `?Page=` — several endpoints validate
 * their query string (`Size` is capped at 100, `Ord1` is a regex) and reject a
 * blank value instead of treating it as absent.
 */
function buildQuery(params: Record<string, QueryValue> = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    search.append(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
): Promise<T> {
  const url = `${baseUrl}${path}${buildQuery(params)}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      signal,
    })
  } catch (err) {
    // A rejected fetch is a network/CORS failure, which has no status of its own.
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, url, `Could not reach the API at ${baseUrl || 'this origin'}.`)
  }

  if (!response.ok) {
    throw new ApiError(response.status, url, `${response.status} ${response.statusText} — ${path}`)
  }

  // A few endpoints answer 200 with an empty body; `[]` is the useful reading.
  const text = await response.text()
  if (!text.trim()) return [] as unknown as T

  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError(response.status, url, `The API returned a non-JSON body for ${path}.`)
  }
}
