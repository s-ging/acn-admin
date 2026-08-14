// src/types/press-release.types.ts
// The press release model.
//
// Classification (sector / industries) is *derived* from the companies the
// release belongs to rather than picked by hand — see lib/press-releases/derive.ts.
// `classification_overridden` is the escape hatch: while it is false the two
// fields recompute whenever the company selection changes, and while it is true
// recomputation stops and the editor owns them.

import type { LanguageCode } from './company.types'

export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived'

export interface ArticleContact {
  id: number
  name: string
  position: string | null
  email: string | null
  phone: string | null
}

// One row of the Translations list: a language and, once it exists, the URL of
// the translated release. `url: null` is the "Add link +" state.
export interface ArticleTranslation {
  language: LanguageCode
  url: string | null
}

export interface PressRelease {
  // ── Identity ──────────────────────────────────────────────────────────
  id: number
  article_id: string

  // Every company responsible for the release, in the order they were added.
  // They carry equal weight: each one contributes its sector to `industries`.
  company_ids: number[]
  // The one company that takes precedence — whose release this ultimately is.
  // It sets `sector_type` and it is the company shown on the canvas. Always
  // either null or a member of `company_ids`; see lib/press-releases/companies.ts.
  primary_issuer_id: number | null

  // ── Content ───────────────────────────────────────────────────────────
  headline: string
  subheadline: string | null
  summary: string | null
  // The dateline is NOT a field. It is the opening of `body_html`, the way the
  // wires and NewsML treat it — see lib/press-releases/dateline.ts. The canvas
  // shows a Dateline box, but it reads and writes this same body text.
  body_html: string | null
  // Whether the dateline has been taken over by hand. `false` (default) means it
  // recomposes from `location` and `published_at`; `true` means someone typed
  // their own and nothing may overwrite it. Same escape hatch as
  // `classification_overridden`.
  dateline_overridden: boolean
  custom_about_html: string | null

  // ── Publication ───────────────────────────────────────────────────────
  published_at: string | null
  status: ArticleStatus

  // ── Classification (derived unless overridden) ─────────────────────────
  sector_type: string | null
  industries: string[]
  topic: string | null
  classification_overridden: boolean
  // Same three-state model as a company's — see lib/languages.ts.
  languages: LanguageCode[]
  secondary_languages: LanguageCode[]

  // ── Location ──────────────────────────────────────────────────────────
  region: string | null
  location: string | null

  // ── Relations ─────────────────────────────────────────────────────────
  supplier: string | null
  contacts: ArticleContact[]
  translations: ArticleTranslation[]

  // ── Distribution ──────────────────────────────────────────────────────
  article_type: string | null
  tracking_id: string | null
  distribute_to: string | null
  source: string | null

  // ── Workflow ──────────────────────────────────────────────────────────
  report_by: string | null
  send_by: string | null

  // ── Audit ─────────────────────────────────────────────────────────────
  created_at: string
  updated_at: string
  updated_by_name: string | null
}
