// src/lib/api/media.ts
// Filenames → URLs.
//
// The API returns bare filenames for every image ("TruMerit.jpg",
// "20260428SC1.jpg"), never a URL, and the three kinds live on three different
// paths. Each base below was confirmed by fetching a filename taken from a live
// API response:
//
//   logoFilename     "TruMerit.jpg"                → /images/company/  (the in-article logo)
//   topLogoFilename  "TruMerit68.jpg"              → /images/toppage/  (the ~68px top logo)
//   bigImage/thumb   "20260427.OMRONHealthcare.jpg" → photos.acnnewswire.com
//   eventImage       "ap10.jpg"                    → /eventimages/
//
// Getting these crossed silently yields a broken image rather than an error,
// which is why they are named after the API field they belong to.

const SITE_BASE = 'https://www.acnnewswire.com'
const PHOTO_BASE = 'https://photos.acnnewswire.com'

/** Guards against `""`, which the server sends as often as null, and against
 *  a value that is already absolute. */
function resolve(base: string, filename: string | null | undefined): string | null {
  const name = filename?.trim()
  if (!name) return null
  if (/^https?:\/\//i.test(name)) return name
  return `${base}/${name.replace(/^\/+/, '')}`
}

/** The logo shown alongside a release. From `logoFilename` / `logoFileName`. */
export function companyLogoUrl(filename: string | null | undefined): string | null {
  return resolve(`${SITE_BASE}/images/company`, filename)
}

/** The small masthead logo. From `topLogoFilename` / `topLogoFileName`. */
export function companyTopLogoUrl(filename: string | null | undefined): string | null {
  return resolve(`${SITE_BASE}/images/toppage`, filename)
}

/** A press release photo. From `bigImage` or `thumbImage`. */
export function articlePhotoUrl(filename: string | null | undefined): string | null {
  return resolve(PHOTO_BASE, filename)
}

/**
 * A company's annual report PDF, from `reportFilename`.
 *
 * UNVERIFIED: no company in the sampled pages had a `reportFilename`, so there
 * was nothing to test a path against. This follows the same `/images/...`
 * convention as the logos and is the best guess available; confirm it against a
 * real record before relying on the link.
 */
export function annualReportUrl(filename: string | null | undefined): string | null {
  return resolve(`${SITE_BASE}/images/report`, filename)
}

/**
 * An event image, from `eventImage`.
 *
 * `/eventimages/`, which is its own top-level path rather than living under
 * `/images/` with the logos. Confirmed against `ap10.jpg` and `ir_magazine.jpg`
 * taken from live event records — the earlier guess of `/images/events/` was
 * wrong, and the 404 that seemed to confirm the asset was missing was really the
 * wrong directory.
 */
export function eventImageUrl(filename: string | null | undefined): string | null {
  return resolve(`${SITE_BASE}/eventimages`, filename)
}
