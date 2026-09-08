// src/lib/api/map-article.ts
// Wire article → PressRelease.
//
// Same rule as map-company.ts: `createArticle` supplies the base so a mapped
// release is always a complete PressRelease, and only fields the API has a
// value for are filled.
//
// Two of the model's "derived unless overridden" flags are deliberately set to
// `true` on an API record. That looks backwards but it is the point — both
// derivations read from *local* state, and running them against a record whose
// companies aren't in localStorage would replace real wire data with blanks:
//
//   classification_overridden — Sector/Industry come from the wire's own
//     `sectors` array. Left recomputing, they would derive from local company
//     records and empty out. See CLASSIFICATION note below.
//   dateline_overridden — true whenever there is a body. See WIRE DATELINES.
//
// What the API has no value for, and is therefore left blank:
//
//   status                — no field. Inferred from publishDate; see mapStatus.
//   created_at/updated_at — no audit timestamps anywhere in the API.
//   topic                 — `topicName` is the constant "Press release
//                           summary" on every record sampled: a section label,
//                           not a topic. Mapping it would fill the field with
//                           the same wrong value for every release.
//   region                — no field.
//   article_type          — no field. `hasImage`/`hasFile` hint at a Photo
//                           Release but are not evidence, so nothing is guessed.
//   tracking_id           — no field.
//   distribute_to         — no field.
//   report_by / send_by   — no field.
//   contacts              — the article endpoints carry no contacts. Company
//                           contacts are a different thing and are not
//                           substituted in.
//   translations          — the list endpoint's `language` describes the record
//                           in hand, and there is no field linking the language
//                           variants of one release to each other.
//   custom_about_html     — no field.
//
// The API's `images` array has no home in the model at all — PressRelease has
// no image gallery, and the photos are not in `bodyHtml` either. `articleImageUrls`
// exposes them so a caller can use them without this mapper inventing a field.

import { createArticle } from '../press-releases/normalize'
import { normalizeSelection } from '../press-releases/companies'
import { SECTORS } from '../sectors'
import { articlePhotoUrl } from './media'
import type {
  ApiArticleFeedItem,
  ApiArticleImage,
  ApiArticleListItem,
  ApiPressRelease,
} from './types'
import type { LanguageCode } from '../../types/company.types'
import type { ArticleStatus, PressRelease } from '../../types/press-release.types'

/** The API has no audit timestamps — see map-company.ts. */
const NO_TIMESTAMP = ''

// ── WIRE DATELINES ──────────────────────────────────────────────────────────
//
// A release off the wire always opens with its own dateline, and a mapped
// release is therefore marked `dateline_overridden` whenever it has a body at
// all — rather than asking `parseDateline` whether there is one to protect.
//
// `parseDateline` would say no, and be wrong. Its recognition rule requires the
// dateline to be plain text whose first word is ALL CAPS, and a wire dateline
// satisfies neither: the wire wraps it in <strong>, which the rule rejects as
// markup, and a Chinese or Japanese release ("賓夕法尼亞州費城, 2026年4月28日")
// has no capitals for the rule to find. Those rules are right for a dateline
// someone typed into the editor, which is what they were written for.
//
// Getting this wrong is not cosmetic. With the flag left false, typing a
// Location into a wire-sourced release lets `applyAutoDateline` prepend a
// second, composed dateline in front of the one already in the body. Marking it
// overridden costs only the auto-fill, on releases that already have the thing
// auto-fill would have supplied.

function str(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * The wire's language tags are not the model's: it sends ZH-CN / ZH-TW where
 * the model uses the script-based ZH-HANS / ZH-HANT. Those four plus EN and JA
 * are every value seen across 500 sampled articles.
 */
const LANGUAGE_BY_API_TAG: Record<string, LanguageCode> = {
  EN: 'EN',
  JA: 'JA',
  JP: 'JA',
  'ZH-CN': 'ZH-HANS',
  'ZH-HANS': 'ZH-HANS',
  'ZH-TW': 'ZH-HANT',
  'ZH-HK': 'ZH-HANT',
  'ZH-HANT': 'ZH-HANT',
  KO: 'KO',
}

export function mapLanguage(tag: string | null | undefined): LanguageCode | null {
  const key = str(tag)?.toUpperCase()
  return key ? LANGUAGE_BY_API_TAG[key] ?? null : null
}

/**
 * Status, inferred from the publish date because the API has no status field.
 *
 * A release dated in the future is scheduled and one dated in the past is
 * published. Nothing maps to 'draft' or 'archived': a record that reached the
 * wire is by definition not a draft, and the API gives no way to tell an
 * archived release from a live one.
 */
export function mapStatus(publishDate: string | null | undefined, now = Date.now()): ArticleStatus {
  const iso = str(publishDate)
  if (!iso) return 'draft'
  const at = new Date(iso).getTime()
  if (Number.isNaN(at)) return 'draft'
  return at > now ? 'scheduled' : 'published'
}

/**
 * CLASSIFICATION — the wire's sector names, resolved against lib/sectors.ts.
 *
 * `sectors` comes back as names ("Healthcare & Pharm", "MedTech"), which is
 * exactly the model's `industries`. `sector_type` is the category of the first
 * one, matching how `deriveClassification` takes Sector from the primary issuer
 * and Industry from everyone.
 */
export function mapClassification(sectors: string[] | null | undefined): {
  sector_type: string | null
  industries: string[]
} {
  const industries = (sectors ?? []).map(s => s.trim()).filter(Boolean)
  const first = industries[0]
  const master = first ? SECTORS.find(s => s.sector_name === first) : undefined

  return {
    sector_type: master?.sector_type ?? null,
    industries,
  }
}

/**
 * The company names carried on a batch of list rows.
 *
 * `PressRelease` stores `company_ids` and nothing else, so a list that wants to
 * show "TruMerit" rather than "#9453" has to resolve the id somewhere. The API
 * already sends the name inline on every row, which beats looking it up in the
 * local company cache — that only has names for companies someone has already
 * loaded, so a direct visit to the releases list would show none.
 */
export function companyNamesFromRows(
  rows: (ApiArticleListItem | ApiArticleFeedItem)[]
): Map<number, string> {
  const names = new Map<number, string>()
  for (const row of rows) {
    for (const company of row.companies) {
      // The two row shapes disagree on the casing of this one field.
      const id = 'companyId' in company ? company.companyId : company.companyID
      const name = str(company.companyName)
      if (id && name && !names.has(id)) names.set(id, name)
    }
  }
  return names
}

/** The photos on a release, as URLs. The model has nowhere to store these. */
export function articleImageUrls(
  images: ApiArticleImage[] | null | undefined
): { thumb: string | null; full: string | null; caption: string | null }[] {
  return (images ?? []).map(img => ({
    thumb: articlePhotoUrl(img.thumbImage),
    full: articlePhotoUrl(img.bigImage),
    caption: str(img.caption),
  }))
}

/**
 * `GET /api/Articles/press-release/{artId}` → PressRelease.
 *
 * `language` is a hint the caller threads through from a list response: the
 * detail endpoint has no language field, but the list row for the same article
 * does. Without it the release keeps `createArticle`'s default of English.
 */
export function mapPressRelease(
  api: ApiPressRelease,
  options: { language?: string | null } = {}
): PressRelease {
  const base = createArticle(api.articleId, NO_TIMESTAMP)
  const companyIds = api.companies.map(c => c.companyID)
  // `bodyHtml` is the markup the editor wants. `body` has been null on every
  // record sampled; `bodyText` is the flattened copy and the last resort.
  const bodyHtml = str(api.bodyHtml) ?? str(api.body) ?? str(api.bodyText)
  const language = mapLanguage(options.language)

  return {
    ...base,
    // The first credited company is the primary issuer; `normalizeSelection`
    // holds the invariant that it is a member of `company_ids`.
    ...normalizeSelection(companyIds, companyIds[0] ?? null),

    headline: str(api.headline) ?? '',
    subheadline: str(api.subHeadLine),
    summary: str(api.summary),
    body_html: bodyHtml,
    dateline_overridden: bodyHtml !== null,

    published_at: str(api.publishDate),
    status: mapStatus(api.publishDate),

    ...mapClassification(api.sectors),
    // The wire's sectors are authoritative; stop them being recomputed from
    // local company records that may not be loaded. See the header note.
    classification_overridden: true,

    languages: language ? [language] : base.languages,

    // `sourceName` is "ACN Newswire" / "JCN Newswire", which are values in both
    // SOURCES and SUPPLIERS in lib/press-releases/options.ts.
    source: str(api.sourceName),
    supplier: str(api.sourceName),

    created_at: NO_TIMESTAMP,
    updated_at: NO_TIMESTAMP,
  }
}

/**
 * `GET /api/Articles` → PressRelease.
 *
 * A list row has no body, sub-headline or sectors, so this produces a release
 * that is real but thin — enough for the list page. It does carry `language`,
 * which the detail endpoint lacks.
 */
export function mapArticleListItem(api: ApiArticleListItem): PressRelease {
  const base = createArticle(api.articleId, NO_TIMESTAMP)
  const companyIds = api.companies.map(c => c.companyId)
  const language = mapLanguage(api.language)

  return {
    ...base,
    ...normalizeSelection(companyIds, companyIds[0] ?? null),
    headline: str(api.headline) ?? '',
    summary: str(api.summary),
    published_at: str(api.publishDate),
    status: mapStatus(api.publishDate),
    languages: language ? [language] : base.languages,
    created_at: NO_TIMESTAMP,
    updated_at: NO_TIMESTAMP,
  }
}

/**
 * `GET /api/Articles/by-industry`, `/by-company/{id}` and `/homepage` → PressRelease.
 *
 * These rows are the opposite trade from `mapArticleListItem`: they carry the
 * article's sector and source but no language, and nest the fuller company
 * shape with its capital-D `companyID`.
 */
export function mapArticleFeedItem(api: ApiArticleFeedItem): PressRelease {
  const base = createArticle(api.articleId, NO_TIMESTAMP)
  const companyIds = api.companies.map(c => c.companyID)
  const sector = str(api.sectorName)

  return {
    ...base,
    ...normalizeSelection(companyIds, companyIds[0] ?? null),
    headline: str(api.headline) ?? '',
    summary: str(api.summary),
    published_at: str(api.publishDate),
    status: mapStatus(api.publishDate),
    ...mapClassification(sector ? [sector] : []),
    classification_overridden: !!sector,
    source: sourceNameFromId(api.sourceId),
    supplier: sourceNameFromId(api.sourceId),
    created_at: NO_TIMESTAMP,
    updated_at: NO_TIMESTAMP,
  }
}

/**
 * The feed rows send `sourceId` without the matching name. The pairing is from
 * the press-release endpoint, which returns both: 2 is ACN and 3 is JCN. Any
 * other id maps to null rather than a guess.
 */
export function sourceNameFromId(sourceId: number | null | undefined): string | null {
  if (sourceId === 2) return 'ACN Newswire'
  if (sourceId === 3) return 'JCN Newswire'
  return null
}
