import { describe, it, expect } from 'vitest'
import {
  articleImageUrls,
  companyNamesFromRows,
  mapArticleFeedItem,
  mapArticleListItem,
  mapClassification,
  mapLanguage,
  mapPressRelease,
  mapStatus,
  sourceNameFromId,
} from './map-article'
import { parseDateline } from '../press-releases/dateline'
import type { ApiArticleFeedItem, ApiArticleListItem, ApiPressRelease } from './types'

// As in map-company.test.ts, the fixtures are real responses from
// development.acnnewswire.com, trimmed but not reshaped.

/** `GET /api/Articles/press-release/106708` — a Traditional Chinese release. */
const PRESS_RELEASE: ApiPressRelease = {
  articleId: 106708,
  headline: '全球護理人員遷徙模式正發生轉變',
  subHeadLine: '《TruMerit 2025年護理人員遷移報告》揭示人力資源不平等現象。',
  body: null,
  bodyText: 'TruMerit™今日發布《2025年護理人員遷移報告》。',
  bodyHtml: '<p style="text-align: justify;"><strong>賓夕法尼亞州費城, 2026年4月28日</strong> - TruMerit™今日發布報告。</p>',
  publishDate: '2026-04-28T22:00:00',
  summary: 'TruMerit™今日發布《2025年護理人員遷移報告》。',
  sourceId: 2,
  sourceName: 'ACN Newswire',
  hasImage: false,
  hasFile: false,
  companies: [{
    companyID: 9453,
    companyName: 'TruMerit',
    companyNameCH: 'TruMerit',
    companyNameCT: 'TruMerit',
    companyNameJP: 'TruMerit',
    companyNameKO: 'TruMerit',
    companyURL: 'trumerit.org',
    logoFileName: 'TruMerit.jpg',
    topLogoFileName: 'TruMerit68.jpg',
    sectorName: null,
  }],
  images: [],
  sectors: ['Healthcare & Pharm'],
  topicName: 'Press release summary',
}

/** `GET /api/Articles?Page=1&Size=1` — the list shape, which alone has `language`. */
const LIST_ITEM: ApiArticleListItem = {
  articleId: 106708,
  headline: '全球護理人員遷徙模式正發生轉變',
  publishDate: '2026-04-28T22:00:00',
  summary: 'TruMerit™今日發布《2025年護理人員遷移報告》。',
  hasImage: false,
  imageUrl: null,
  language: 'ZH-TW',
  companies: [{ companyId: 9453, companyName: 'TruMerit', logoFilename: 'TruMerit.jpg' }],
  images: [],
}

/** `GET /api/Articles/by-industry` — the feed shape, with sector and sourceId. */
const FEED_ITEM: ApiArticleFeedItem = {
  articleId: 106649,
  headline: 'TANAKA to Showcase Advanced Semiconductor Materials',
  publishDate: '2026-04-28T20:00:00',
  summary: 'TANAKA PRECIOUS METAL TECHNOLOGIES will exhibit.',
  sourceId: 3,
  hasImage: false,
  hasFile: false,
  sectorName: 'Electronics',
  companies: [{
    companyID: 3128,
    companyName: 'JCN Newswire',
    companyNameCH: '', companyNameCT: '', companyNameJP: 'JCN Newswire', companyNameKO: '',
    companyURL: 'jcnnewswire.com',
    logoFileName: '', topLogoFileName: '',
    sectorName: 'Business',
  }],
  images: [],
}

describe('mapLanguage', () => {
  it('translates the wire’s region tags to the model’s script tags', () => {
    // These four are every value seen across 500 sampled articles.
    expect(mapLanguage('EN')).toBe('EN')
    expect(mapLanguage('JA')).toBe('JA')
    expect(mapLanguage('ZH-CN')).toBe('ZH-HANS')
    expect(mapLanguage('ZH-TW')).toBe('ZH-HANT')
  })

  it('is case-insensitive and returns null for anything unrecognised', () => {
    expect(mapLanguage('zh-tw')).toBe('ZH-HANT')
    expect(mapLanguage('')).toBeNull()
    expect(mapLanguage(null)).toBeNull()
    expect(mapLanguage('XX')).toBeNull()
  })
})

describe('mapStatus', () => {
  const now = new Date('2026-05-01T00:00:00Z').getTime()

  it('reads a past publish date as published and a future one as scheduled', () => {
    expect(mapStatus('2026-04-28T22:00:00Z', now)).toBe('published')
    expect(mapStatus('2026-06-01T00:00:00Z', now)).toBe('scheduled')
  })

  it('falls back to draft with no usable date', () => {
    expect(mapStatus(null, now)).toBe('draft')
    expect(mapStatus('', now)).toBe('draft')
    expect(mapStatus('not a date', now)).toBe('draft')
  })
})

describe('mapClassification', () => {
  it('takes industries from the wire’s names and sector_type from the taxonomy', () => {
    const result = mapClassification(['Healthcare & Pharm', 'MedTech'])
    expect(result.industries).toEqual(['Healthcare & Pharm', 'MedTech'])
    expect(result.sector_type).toBe('Medicine')
  })

  it('keeps an industry the taxonomy doesn’t know, but claims no sector for it', () => {
    const result = mapClassification(['Some Brand New Sector'])
    expect(result.industries).toEqual(['Some Brand New Sector'])
    expect(result.sector_type).toBeNull()
  })

  it('handles an empty or missing list', () => {
    expect(mapClassification([])).toEqual({ sector_type: null, industries: [] })
    expect(mapClassification(null)).toEqual({ sector_type: null, industries: [] })
  })
})

describe('sourceNameFromId', () => {
  it('maps the two ids the wire actually uses', () => {
    expect(sourceNameFromId(2)).toBe('ACN Newswire')
    expect(sourceNameFromId(3)).toBe('JCN Newswire')
  })

  it('refuses to guess at anything else', () => {
    expect(sourceNameFromId(99)).toBeNull()
    expect(sourceNameFromId(null)).toBeNull()
  })
})

describe('mapPressRelease', () => {
  it('maps the content fields, preferring bodyHtml over the flattened text', () => {
    const release = mapPressRelease(PRESS_RELEASE)
    expect(release.id).toBe(106708)
    expect(release.headline).toContain('全球護理人員')
    expect(release.subheadline).toContain('TruMerit')
    expect(release.body_html).toContain('<strong>')
  })

  it('falls back to bodyText when there is no markup', () => {
    const release = mapPressRelease({ ...PRESS_RELEASE, bodyHtml: null, body: null })
    expect(release.body_html).toBe('TruMerit™今日發布《2025年護理人員遷移報告》。')
  })

  it('credits the first company as the primary issuer', () => {
    const release = mapPressRelease(PRESS_RELEASE)
    expect(release.company_ids).toEqual([9453])
    expect(release.primary_issuer_id).toBe(9453)
  })

  it('protects the wire’s classification from being recomputed from local records', () => {
    const release = mapPressRelease(PRESS_RELEASE)
    expect(release.industries).toEqual(['Healthcare & Pharm'])
    expect(release.sector_type).toBe('Medicine')
    // Left false, deriveClassification would empty these out for a release
    // whose companies aren't in localStorage.
    expect(release.classification_overridden).toBe(true)
  })

  // See the WIRE DATELINES note in map-article.ts. parseDateline cannot see a
  // wire dateline — it is <strong>-wrapped, and CJK ones have no capitals — so
  // a body off the wire is protected on the strength of being a body.
  it('protects a <strong>-wrapped CJK dateline that parseDateline cannot see', () => {
    expect(parseDateline(PRESS_RELEASE.bodyHtml)).toBeNull()
    expect(mapPressRelease(PRESS_RELEASE).dateline_overridden).toBe(true)
  })

  it('protects a plain English wire dateline too', () => {
    const release = mapPressRelease({
      ...PRESS_RELEASE,
      bodyHtml: '<p><strong>TOKYO, Apr 28, 2026</strong> - TANAKA said.</p>',
    })
    expect(release.dateline_overridden).toBe(true)
  })

  it('leaves a release with no body at all recomputable', () => {
    const release = mapPressRelease({ ...PRESS_RELEASE, bodyHtml: null, body: null, bodyText: null })
    expect(release.body_html).toBeNull()
    expect(release.dateline_overridden).toBe(false)
  })

  it('takes the language from the caller’s hint, since the detail endpoint has none', () => {
    expect(mapPressRelease(PRESS_RELEASE, { language: 'ZH-TW' }).languages).toEqual(['ZH-HANT'])
    // Without a hint it keeps createArticle's default.
    expect(mapPressRelease(PRESS_RELEASE).languages).toEqual(['EN'])
  })

  it('maps sourceName to both source and supplier', () => {
    const release = mapPressRelease(PRESS_RELEASE)
    expect(release.source).toBe('ACN Newswire')
    expect(release.supplier).toBe('ACN Newswire')
  })

  it('does not write the constant topicName into topic', () => {
    // "Press release summary" is a section label, not a topic — mapping it
    // would give every release on the wire the same wrong topic.
    expect(mapPressRelease(PRESS_RELEASE).topic).toBeNull()
  })

  it('produces a complete record, so no field is undefined', () => {
    const release = mapPressRelease(PRESS_RELEASE)
    for (const [key, value] of Object.entries(release)) {
      expect(value, `${key} should be null, not undefined`).not.toBeUndefined()
    }
  })
})

describe('mapArticleListItem', () => {
  it('maps a thin list row, including the language only this shape carries', () => {
    const release = mapArticleListItem(LIST_ITEM)
    expect(release.id).toBe(106708)
    expect(release.languages).toEqual(['ZH-HANT'])
    expect(release.status).toBe('published')
    expect(release.company_ids).toEqual([9453])
  })

  it('has no body, since the list row carries none', () => {
    expect(mapArticleListItem(LIST_ITEM).body_html).toBeNull()
  })
})

describe('mapArticleFeedItem', () => {
  it('reads the capital-D companyID this shape uses', () => {
    const release = mapArticleFeedItem(FEED_ITEM)
    expect(release.company_ids).toEqual([3128])
    expect(release.primary_issuer_id).toBe(3128)
  })

  it('maps the single sectorName into the classification', () => {
    const release = mapArticleFeedItem(FEED_ITEM)
    expect(release.industries).toEqual(['Electronics'])
    expect(release.sector_type).toBe('Technology')
    expect(release.classification_overridden).toBe(true)
  })

  it('resolves the source from sourceId, which this shape sends without a name', () => {
    expect(mapArticleFeedItem(FEED_ITEM).source).toBe('JCN Newswire')
  })

  it('leaves the classification recomputable when the row has no sector', () => {
    const release = mapArticleFeedItem({ ...FEED_ITEM, sectorName: null })
    expect(release.industries).toEqual([])
    expect(release.classification_overridden).toBe(false)
  })
})

describe('companyNamesFromRows', () => {
  it('reads names from the list shape’s lowercase companyId', () => {
    expect(companyNamesFromRows([LIST_ITEM])).toEqual(new Map([[9453, 'TruMerit']]))
  })

  it('reads names from the feed shape’s capital-D companyID', () => {
    expect(companyNamesFromRows([FEED_ITEM])).toEqual(new Map([[3128, 'JCN Newswire']]))
  })

  it('collects across both shapes at once and skips blank names', () => {
    const blank = { ...FEED_ITEM, companies: [{ ...FEED_ITEM.companies[0], companyID: 42, companyName: '' }] }
    const names = companyNamesFromRows([LIST_ITEM, FEED_ITEM, blank])
    expect(names.get(9453)).toBe('TruMerit')
    expect(names.get(3128)).toBe('JCN Newswire')
    expect(names.has(42)).toBe(false)
  })
})

describe('articleImageUrls', () => {
  it('resolves the bare filenames onto the photo host', () => {
    const urls = articleImageUrls([
      { thumbImage: '', bigImage: '20260427.OMRONHealthcare.jpg', caption: '' },
    ])
    expect(urls[0].full).toBe('https://photos.acnnewswire.com/20260427.OMRONHealthcare.jpg')
    // "" is the wire's blank, not a relative path to the host root.
    expect(urls[0].thumb).toBeNull()
    expect(urls[0].caption).toBeNull()
  })

  it('handles a missing list', () => {
    expect(articleImageUrls(null)).toEqual([])
  })
})
