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
