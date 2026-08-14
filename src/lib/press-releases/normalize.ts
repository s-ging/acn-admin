// src/lib/press-releases/normalize.ts
// Brings a press release parsed from JSON up to the current shape.
//
// Same choke point as normalizeCompany, and present from day one for the same
// reason: records come back from localStorage as whatever shape they were saved
// in and then get cast to PressRelease, so any field added later is `undefined`
// at runtime on an older record even though the type says otherwise. Every read
// goes through here — there is no second path.

import { normalizeLanguageTags } from '../languages'
import { normalizeSelection } from './companies'
import { parseDateline } from './dateline'
import type { PressRelease } from '../../types/press-release.types'

/** The pre-primary-issuer shape: one company plus a bag of extras. */
interface LegacyCompanyFields {
  company_id?: number | null
  related_company_ids?: number[]
}

/**
 * Folds the old `company_id` + `related_company_ids` pair into the flat
 * `company_ids` list with one `primary_issuer_id`.
 *
 * The old singular company was by definition the one that took precedence, so
 * it becomes the primary issuer and keeps its position at the head of the list.
 */
function migrateCompanies(article: PressRelease) {
  const legacy = article as PressRelease & LegacyCompanyFields

  const ids = article.company_ids ?? [
    ...(legacy.company_id != null ? [legacy.company_id] : []),
    ...(legacy.related_company_ids ?? []),
  ]

  return normalizeSelection(ids, article.primary_issuer_id ?? legacy.company_id ?? null)
}

/**
 * Whether the dateline should be left alone.
 *
 * A record written before the flag existed gets it inferred, and the inference
 * errs towards protection: if there is already a dateline in the body, assume a
 * person put it there and mark it overridden. Auto-fill then only ever applies
 * to releases that have no dateline to lose.
 */
function datelineOverridden(article: PressRelease): boolean {
  if (typeof article.dateline_overridden === 'boolean') return article.dateline_overridden
  return parseDateline(article.body_html) !== null
}

export function normalizeArticle(article: PressRelease): PressRelease {
  return {
    ...article,
    // Fills in secondary_languages and holds the one-main-language invariant.
    ...normalizeLanguageTags(article),
    // Holds the two company invariants: no duplicates, and the primary issuer
    // is always a company that is actually on the release.
    ...migrateCompanies(article),

    headline: article.headline ?? '',
    subheadline: article.subheadline ?? null,
    summary: article.summary ?? null,
    body_html: article.body_html ?? null,
    dateline_overridden: datelineOverridden(article),
    custom_about_html: article.custom_about_html ?? null,

    article_id: article.article_id || formatArticleId(article.id),
    status: article.status ?? 'draft',
    published_at: article.published_at ?? null,

    sector_type: article.sector_type ?? null,
    industries: article.industries ?? [],
    topic: article.topic ?? null,
    classification_overridden: article.classification_overridden ?? false,

    region: article.region ?? null,
    location: article.location ?? null,

    supplier: article.supplier ?? null,
    contacts: article.contacts ?? [],
    translations: article.translations ?? [],

    article_type: article.article_type ?? null,
    tracking_id: article.tracking_id ?? null,
    distribute_to: article.distribute_to ?? null,
    source: article.source ?? null,

    report_by: article.report_by ?? null,
    send_by: article.send_by ?? null,

    updated_by_name: article.updated_by_name ?? null,
  }
}

export function formatArticleId(id: number): string {
  return `ACN-${id}`
}

/** A blank release. The shape `/article/new` writes before it redirects. */
export function createArticle(id: number, now = new Date().toISOString()): PressRelease {
  return {
    id,
    article_id: formatArticleId(id),
    company_ids: [],
    primary_issuer_id: null,

    headline: '',
    subheadline: null,
    summary: null,
    body_html: null,
    // A new release has no dateline to protect, so it follows Location and Date.
    dateline_overridden: false,
    custom_about_html: null,

    published_at: now,
    status: 'draft',

    sector_type: null,
    industries: [],
    topic: null,
    classification_overridden: false,
    languages: ['EN'],
    secondary_languages: [],

    region: null,
    location: null,

    supplier: null,
    contacts: [],
    translations: [],

    article_type: null,
    tracking_id: null,
    distribute_to: null,
    source: null,

    report_by: null,
    send_by: null,

    created_at: now,
    updated_at: now,
    updated_by_name: null,
  }
}
