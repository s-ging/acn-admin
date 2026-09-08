// src/lib/press-releases/storage.ts
// localStorage access for press releases, under acn_article_{id} — the same
// convention companies use. Every read normalises; nothing else parses these keys.

import { normalizeArticle } from './normalize'
import type { PressRelease } from '../../types/press-release.types'

const PREFIX = 'acn_article_'

export function loadArticles(): PressRelease[] {
  return Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .map(k => {
      try { return normalizeArticle(JSON.parse(localStorage.getItem(k) || '') as PressRelease) }
      catch { return null }
    })
    .filter(Boolean) as PressRelease[]
}

export function loadArticle(id: string | number): PressRelease | null {
  const stored = localStorage.getItem(`${PREFIX}${id}`)
  if (!stored) return null
  try { return normalizeArticle(JSON.parse(stored) as PressRelease) }
  catch { return null }
}

export type SaveResult = { ok: true } | { ok: false; message: string }

/**
 * Writes the release back.
 *
 * This can genuinely fail now that the body can carry uploaded images: they are
 * inlined as base64 data URLs, and localStorage caps an origin at roughly 5MB.
 * A thrown QuotaExceededError here would abort the save with nothing shown to
 * the person who wrote the release, so it comes back as a result to report.
 */
export function saveArticle(article: PressRelease): SaveResult {
  try {
    localStorage.setItem(`${PREFIX}${article.id}`, JSON.stringify(article))
    // Records the edit so a later API fetch can't overwrite it — see cacheArticle.
    markEdited(article.id)
    return { ok: true }
  } catch (err) {
    const quotaExceeded =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')

    return {
      ok: false,
      message: quotaExceeded
        ? 'Out of local storage. Uploaded images are embedded in the release — link to hosted images instead, or remove some.'
        : 'Could not save the release to local storage.',
    }
  }
}

/** The next free id. Mirrors generateCompanyId on the companies list page. */
export function generateArticleId(): number {
  const existing = Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .map(k => {
      const parsed = parseInt(k.replace(PREFIX, ''), 10)
      return isNaN(parsed) ? 0 : parsed
    })
  const max = existing.length > 0 ? Math.max(...existing) : 1999
  return max + 1
}

// ── The API overlay ─────────────────────────────────────────────────────────
//
// Same split as companies — see the note in lib/companies/storage.ts. The ACN
// Newswire API is read-only, so localStorage is both the cache of what the wire
// said and the only home for an edit, and `cacheArticle` is what keeps a fetch
// from overwriting someone's work.

const EDITED_KEY = 'acn_article_edited'

function editedIds(): Set<number> {
  try {
    const raw = localStorage.getItem(EDITED_KEY)
    return new Set(raw ? (JSON.parse(raw) as number[]) : [])
  } catch {
    return new Set()
  }
}

/** Whether this release carries local edits that the API must not overwrite. */
export function isLocallyEdited(id: number): boolean {
  return editedIds().has(id)
}

function markEdited(id: number): void {
  const ids = editedIds()
  if (ids.has(id)) return
  ids.add(id)
  try {
    localStorage.setItem(EDITED_KEY, JSON.stringify([...ids]))
  } catch {
    // Out of quota; the release itself is already written.
  }
}

/**
 * Stores a release fetched from the API, unless it has been edited locally.
 * Returns the record that should actually be shown.
 *
 * Unlike `saveArticle` this doesn't report failure: a release straight off the
 * wire has no base64 images to blow the quota, and a failed *cache* write costs
 * nothing — the caller still holds the fetched record.
 */
export function cacheArticle(article: PressRelease): PressRelease {
  if (isLocallyEdited(article.id)) {
    return loadArticle(article.id) ?? article
  }
  try {
    localStorage.setItem(`${PREFIX}${article.id}`, JSON.stringify(article))
  } catch {
    // Best-effort.
  }
  return article
}

/**
 * Caches one page of API releases, returning what should be displayed for each.
 *
 * A page, never the whole set: there are 78,874 releases on the wire. One page
 * is small enough to store and is what gives the editor its language hint and
 * an offline fallback, so unlike companies — which have no bulk cache at all,
 * see the note in lib/companies/storage.ts — releases are cached as they are
 * browsed. Quota failures are absorbed by `cacheArticle`.
 */
export function cacheArticles(articles: PressRelease[]): PressRelease[] {
  return articles.map(cacheArticle)
}

