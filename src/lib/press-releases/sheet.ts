// src/lib/press-releases/sheet.ts
// The press release projection for the spreadsheet view. Everything generic
// lives in lib/sheet; this is only what makes a release a release.
//
// Two things are deliberately read-only here, because a grid cell is the wrong
// tool for them and writing one would quietly break an invariant:
//
//  * The body, and with it the dateline. The dateline is not a field — it is the
//    opening of `body_html` (see lib/press-releases/dateline.ts) — so a cell
//    cannot own it. The sheet shows a plain-text excerpt instead.
//  * Sector and industries. They are derived from the companies on the release
//    unless `classification_overridden` is set (see derive.ts). Typing a sector
//    into a cell would set the value while leaving the override flag false, so
//    the next company change would silently recompute it away.

import { createArticle, formatArticleId } from './normalize'
import { generateArticleId, loadArticle, loadArticles, saveArticle } from './storage'
import {
  ARTICLE_STATUSES,
  ARTICLE_TYPES,
  DISTRIBUTION_TARGETS,
  REGIONS,
  SOURCES,
  SUPPLIERS,
  TOPICS,
} from './options'
import type { SheetColumn, SheetSource } from '../sheet/schema'
import type { PressRelease } from '../../types/press-release.types'

const STATUS_OPTIONS = ARTICLE_STATUSES.map(s => s.value)

/** Strips tags and collapses whitespace, for showing body text inside a cell. */
function excerpt(html: string | null, length = 120): string {
  if (!html) return ''
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > length ? `${text.slice(0, length)}…` : text
}

const COLUMNS: readonly SheetColumn<PressRelease>[] = [
  { key: 'id', header: 'ID', width: 64, kind: 'id' },
  {
    key: 'article_id',
    header: 'Article ID',
    width: 100,
    kind: 'derived',
    get: a => a.article_id || formatArticleId(a.id),
  },

  // ── Content ─────────────────────────────────────────────────────────────
  { key: 'headline', header: 'Headline', width: 320, kind: 'text' },
  { key: 'status', header: 'Status', width: 100, kind: 'enum', options: STATUS_OPTIONS },
  { key: 'subheadline', header: 'Subheadline', width: 240, kind: 'text' },
  { key: 'summary', header: 'Summary', width: 280, kind: 'text' },

  // ── Publication ─────────────────────────────────────────────────────────
  // Shown as the stored ISO string rather than a friendly format: the cell is
  // writable, and a display format would have to be parsed back on save, where
  // "2026-08-15T10:00" (local) and "…:00.000Z" (UTC) are hours apart.
  { key: 'published_at', header: 'Published at (ISO)', width: 210, kind: 'text' },

  // ── Location ────────────────────────────────────────────────────────────
  { key: 'region', header: 'Region', width: 130, kind: 'enum', options: REGIONS },
  { key: 'location', header: 'Location', width: 150, kind: 'text' },

  // ── Classification ──────────────────────────────────────────────────────
  { key: 'topic', header: 'Topic', width: 170, kind: 'enum', options: TOPICS },
  { key: 'languages', header: 'Main language', width: 110, kind: 'langs' },
  { key: 'secondary_languages', header: 'Other languages', width: 140, kind: 'langs' },

  // ── Distribution ────────────────────────────────────────────────────────
  { key: 'article_type', header: 'Article type', width: 150, kind: 'enum', options: ARTICLE_TYPES },
  {
    key: 'distribute_to',
    header: 'Distribute to',
    width: 160,
    kind: 'enum',
    options: DISTRIBUTION_TARGETS,
  },
  { key: 'source', header: 'Source', width: 140, kind: 'enum', options: SOURCES },
  { key: 'supplier', header: 'Supplier', width: 150, kind: 'enum', options: SUPPLIERS },
  { key: 'tracking_id', header: 'Tracking ID', width: 130, kind: 'text' },

  // ── Workflow ────────────────────────────────────────────────────────────
  { key: 'report_by', header: 'Report by', width: 130, kind: 'text' },
  { key: 'send_by', header: 'Send by', width: 130, kind: 'text' },

  // ── Derived — read-only, owned by the release editor ────────────────────
  {
    key: 'sector_type',
    header: 'Sector',
    width: 150,
    kind: 'derived',
    get: a => a.sector_type ?? '',
  },
  {
    key: 'industries',
    header: 'Industries',
    width: 200,
    kind: 'derived',
    get: a => a.industries.join(', '),
  },
  {
    key: 'companies',
    header: 'Companies',
    width: 90,
    kind: 'derived',
    get: a => String(a.company_ids.length),
  },
  {
    key: 'primary_issuer_id',
    header: 'Issuer ID',
    width: 90,
    kind: 'derived',
    get: a => (a.primary_issuer_id == null ? '' : String(a.primary_issuer_id)),
  },
  {
    key: 'body',
    header: 'Body',
    width: 320,
    kind: 'derived',
    get: a => excerpt(a.body_html),
  },
  {
    key: 'translations',
    header: 'Translations',
    width: 110,
    kind: 'derived',
    get: a => String(a.translations.length),
  },
  {
    key: 'contacts_count',
    header: 'Contacts',
    width: 80,
    kind: 'derived',
    get: a => String(a.contacts.length),
  },
  {
    key: 'updated_at',
    header: 'Modified',
    width: 150,
    kind: 'derived',
    get: a => (a.updated_at ? a.updated_at.slice(0, 16).replace('T', ' ') : ''),
  },
  {
    key: 'updated_by_name',
    header: 'Modified by',
    width: 140,
    kind: 'derived',
    get: a => a.updated_by_name ?? '',
  },
]

export const pressReleaseSheetSource: SheetSource<PressRelease> = {
  // Cased to match the breadcrumb on the list page exactly — the sheet's crumb
  // reuses this, and "Press releases › Spreadsheet" beside a list reading
  // "Press Releases" would read as a different section.
  title: 'Press Releases',
  listRoute: '/article',
  columns: COLUMNS,
  load: loadArticles,
  loadOne: id => loadArticle(id),
  // `saveArticle` can genuinely fail — bodies carry base64 images and
  // localStorage caps an origin at ~5MB — so its result is passed straight
  // through and surfaces as a failed row rather than a silent drop.
  save: saveArticle,
  create: () => createArticle(generateArticleId()),
  idOf: article => article.id,
  touch: article => ({ ...article, updated_at: new Date().toISOString() }),
  ensureLabel: article =>
    article.headline ? article : { ...article, headline: 'Untitled release' },
}
