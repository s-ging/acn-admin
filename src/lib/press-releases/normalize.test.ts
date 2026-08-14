import { describe, it, expect } from 'vitest'
import { normalizeArticle, createArticle } from './normalize'
import type { PressRelease } from '../../types/press-release.types'

const TOYOTA = 91
const HONDA = 117
const MHI = 82

/** A record as it was stored before the flat company list existed. */
function legacyArticle(fields: Record<string, unknown>): PressRelease {
  return {
    id: 2002,
    article_id: 'ACN-2002',
    headline: 'Joint initiative',
    status: 'draft',
    languages: ['EN'],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...fields,
  } as unknown as PressRelease
}

describe('normalizeArticle — company migration', () => {
  it('folds the old company_id and related_company_ids into one list', () => {
    const article = normalizeArticle(legacyArticle({
      company_id: TOYOTA,
      related_company_ids: [HONDA, MHI],
    }))

    expect(article.company_ids).toEqual([TOYOTA, HONDA, MHI])
    // The old singular company was by definition the one that took precedence.
    expect(article.primary_issuer_id).toBe(TOYOTA)
  })

  it('handles a legacy record with only the one company', () => {
    const article = normalizeArticle(legacyArticle({ company_id: MHI }))
    expect(article.company_ids).toEqual([MHI])
    expect(article.primary_issuer_id).toBe(MHI)
  })

  it('handles a legacy record with no company at all', () => {
    const article = normalizeArticle(legacyArticle({ company_id: null, related_company_ids: [] }))
    expect(article.company_ids).toEqual([])
    expect(article.primary_issuer_id).toBeNull()
  })

  it('promotes the first company when the legacy record had extras but no primary', () => {
    const article = normalizeArticle(legacyArticle({
      company_id: null,
      related_company_ids: [HONDA, MHI],
    }))
    expect(article.company_ids).toEqual([HONDA, MHI])
    expect(article.primary_issuer_id).toBe(HONDA)
  })

  it('drops a company listed both as primary and as related', () => {
    const article = normalizeArticle(legacyArticle({
      company_id: TOYOTA,
      related_company_ids: [TOYOTA, HONDA],
    }))
    expect(article.company_ids).toEqual([TOYOTA, HONDA])
  })

  it('leaves an already-migrated record alone', () => {
    const article = normalizeArticle(legacyArticle({
      company_ids: [TOYOTA, HONDA],
      primary_issuer_id: HONDA,
    }))
    expect(article.company_ids).toEqual([TOYOTA, HONDA])
    expect(article.primary_issuer_id).toBe(HONDA)
  })

  it('repairs an issuer that is not on the release', () => {
    const article = normalizeArticle(legacyArticle({
      company_ids: [TOYOTA, HONDA],
      primary_issuer_id: MHI,
    }))
    expect(article.primary_issuer_id).toBe(TOYOTA)
  })
})

describe('normalizeArticle — missing fields', () => {
  it('fills in every collection on a record saved before they existed', () => {
    const article = normalizeArticle(legacyArticle({}))
    expect(article.company_ids).toEqual([])
    expect(article.industries).toEqual([])
    expect(article.contacts).toEqual([])
    expect(article.translations).toEqual([])
    expect(article.secondary_languages).toEqual([])
    expect(article.classification_overridden).toBe(false)
  })

  it('generates an article_id when one is missing', () => {
    expect(normalizeArticle(legacyArticle({ article_id: '' })).article_id).toBe('ACN-2002')
  })

  it('is idempotent', () => {
    const once = normalizeArticle(legacyArticle({ company_id: TOYOTA, related_company_ids: [HONDA] }))
    expect(normalizeArticle(once)).toEqual(once)
  })
})

describe('normalizeArticle — dateline protection', () => {
  it('marks a legacy record that already has a dateline as hand-written', () => {
    // Nothing may silently rewrite copy that predates the flag.
    const article = normalizeArticle(legacyArticle({
      body_html: '<p>TOKYO, August 14, 2020 - Toyota said.</p>',
    }))
    expect(article.dateline_overridden).toBe(true)
  })

  it('lets a legacy record with no dateline follow Location', () => {
    const article = normalizeArticle(legacyArticle({
      body_html: '<p>Toyota said today.</p>',
    }))
    expect(article.dateline_overridden).toBe(false)
  })

  it('treats an empty body as free to fill', () => {
    expect(normalizeArticle(legacyArticle({ body_html: null })).dateline_overridden).toBe(false)
  })

  it('respects the flag once a record carries one', () => {
    expect(normalizeArticle(legacyArticle({
      body_html: '<p>TOKYO, August 14, 2020 - Toyota said.</p>',
      dateline_overridden: false,
    })).dateline_overridden).toBe(false)

    expect(normalizeArticle(legacyArticle({
      body_html: '<p>Toyota said today.</p>',
      dateline_overridden: true,
    })).dateline_overridden).toBe(true)
  })
})

describe('createArticle', () => {
  it('starts with no companies and no issuer', () => {
    const article = createArticle(2010, '2026-08-15T00:00:00Z')
    expect(article.company_ids).toEqual([])
    expect(article.primary_issuer_id).toBeNull()
    expect(article.article_id).toBe('ACN-2010')
  })

  it('survives normalisation unchanged', () => {
    const article = createArticle(2010, '2026-08-15T00:00:00Z')
    expect(normalizeArticle(article)).toEqual(article)
  })
})
