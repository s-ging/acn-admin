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

/** Overridable so a deployment can point at staging or production. */
const DEFAULT_BASE_URL = 'https://development.acnnewswire.com'

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  DEFAULT_BASE_URL

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
  const url = `${API_BASE_URL}${path}${buildQuery(params)}`

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
    throw new ApiError(0, url, `Could not reach the API at ${API_BASE_URL}.`)
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
