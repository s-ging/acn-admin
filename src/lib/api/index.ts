// src/lib/api/index.ts
// The ACN Newswire API, in one import.
//
// Spec: https://development.acnnewswire.com/swagger/index.html
//
// Layout of this folder, outermost first:
//
//   repository.ts  — load a record without caring where it came from (API or
//                    localStorage). What the pages use.
//   map-*.ts       — wire shape → CompanyFull / PressRelease. Both files open
//                    with the list of fields the API has no value for.
//   endpoints.ts   — one function per swagger operation. All thirteen.
//   types.ts       — the wire shapes, hand-written: the spec declares no
//                    response schemas.
//   media.ts       — image filenames → URLs.
//   client.ts      — fetch, base URL, ApiError. Requests go through this
//                    origin's /wire proxy, never straight at the API — the
//                    API's CORS is an allowlist. See resolveBaseUrl there.
//
// The one fact worth repeating: every operation in the spec is a GET. There is
// no write path, so editing still goes to localStorage.

export {
  API_PROXY_PREFIX,
  API_UPSTREAM_URL,
  ApiError,
  apiGet,
  getApiBaseUrl,
  setApiBaseUrl,
  setAuthToken,
} from './client'
export type { QueryValue } from './client'

export * from './endpoints'
export * from './types'
export * from './media'
export * from './map-company'
export * from './map-article'
export * from './repository'
