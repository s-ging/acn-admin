// src/lib/companies/storage.ts
// localStorage for companies. Two copies per company, never mixed:
//
//   acn_company_{id}        BASE  — the last version fetched from the API.
//                                   Written by fetches and by a commit's
//                                   re-fetch. Never by an edit.
//   acn_company_draft_{id}  DRAFT — the user's uncommitted edits, autosaved.
//                                   Exists only while it differs from the base.
//
// The diff is always base → draft (lib/companies/diff.ts). A commit sends it,
// re-fetches the base, and drops the draft once the base matches it
// (lib/companies/sync.ts).
//
// A company created here has a draft and no base until its first commit, and is
// recognisable by a non-empty `created_at` (the mappers leave it empty).
//
// Every read normalises. The press release editor and the sheet read the
// "working copy" — draft if there is one, else base — through loadCompany /
// loadCompanies, so they see edits that haven't been committed yet.

import { normalizeCompany } from './normalize'
import type { CompanyFull } from '../../types/company.types'

const BASE_PREFIX = 'acn_company_'
const DRAFT_PREFIX = 'acn_company_draft_'
const BASE_KEY = /^acn_company_(\d+)$/
const DRAFT_KEY = /^acn_company_draft_(\d+)$/

/** Ids for companies created here start above anything the wire uses (~10k), so the two never collide. */
const LOCAL_ID_FLOOR = 9_000_000

function read(key: string): CompanyFull | null {
  const stored = localStorage.getItem(key)
  if (!stored) return null
  try { return normalizeCompany(JSON.parse(stored) as CompanyFull) }
  catch { return null }
}

function write(key: string, company: CompanyFull): void {
  // A data: URI is an in-browser upload preview; far too large for localStorage.
  const toStore = company.annual_report_url?.startsWith('data:')
    ? { ...company, annual_report_url: null }
    : company
  localStorage.setItem(key, JSON.stringify(toStore))
}

function idsMatching(pattern: RegExp): number[] {
  migrateLegacyEdits()
  return Object.keys(localStorage)
    .map(k => pattern.exec(k)?.[1])
    .filter((id): id is string => id !== undefined)
    .map(Number)
}

// ── Base ────────────────────────────────────────────────────────────────────

export function loadBase(id: number): CompanyFull | null {
  migrateLegacyEdits()
  return read(`${BASE_PREFIX}${id}`)
}

/** Best-effort: a base is a cache of the API and can always be re-fetched. */
export function saveBase(company: CompanyFull): void {
  try { write(`${BASE_PREFIX}${company.id}`, company) } catch { /* quota */ }
}

export function deleteBase(id: number): void {
  localStorage.removeItem(`${BASE_PREFIX}${id}`)
}

// ── Draft ───────────────────────────────────────────────────────────────────

export function loadDraft(id: number): CompanyFull | null {
  migrateLegacyEdits()
  return read(`${DRAFT_PREFIX}${id}`)
}

/** Throws on quota — unlike a base, a draft is the only copy of the user's work. */
export function saveDraft(company: CompanyFull): void {
  write(`${DRAFT_PREFIX}${company.id}`, company)
}

export function deleteDraft(id: number): void {
  localStorage.removeItem(`${DRAFT_PREFIX}${id}`)
}

export function hasDraft(id: number): boolean {
  return loadDraft(id) !== null
}

export function draftIds(): number[] {
  return idsMatching(DRAFT_KEY)
}

// ── Working copy (draft ?? base) ────────────────────────────────────────────

export function loadCompany(id: string | number | null): CompanyFull | null {
  if (id === null || id === '') return null
  const n = Number(id)
  return loadDraft(n) ?? loadBase(n)
}

export function loadCompanies(): CompanyFull[] {
  const ids = new Set([...idsMatching(BASE_KEY), ...idsMatching(DRAFT_KEY)])
  return [...ids].map(id => loadCompany(id)).filter((c): c is CompanyFull => c !== null)
}

/**
 * An edit from somewhere other than the record editor — the sheet, the list's
 * "+ New company". It becomes the draft, exactly as an editor edit does, and is
 * committed from the editor.
 */
export function saveCompany(company: CompanyFull): void {
  saveDraft(company)
}

/** Whether this company has uncommitted edits. */
export function isLocallyEdited(id: number): boolean {
  return hasDraft(id)
}

/** Removes every local trace of a company. */
export function deleteLocalCompany(id: number): void {
  deleteDraft(id)
  deleteBase(id)
}

/** The next free id for a company created here. */
export function nextCompanyId(): number {
  const local = [...idsMatching(BASE_KEY), ...idsMatching(DRAFT_KEY)].filter(id => id >= LOCAL_ID_FLOOR)
  return (local.length ? Math.max(...local) : LOCAL_ID_FLOOR) + 1
}

// ── Migration ───────────────────────────────────────────────────────────────
//
// Before the base/draft split, acn_company_{id} held EITHER the API's copy OR an
// edited one, with the edited ids listed under acn_company_edited — and records
// created here lived there too. Both kinds are user work, so they move to the
// draft key; their base is simply re-fetched next time the company is opened.

const LEGACY_EDITED_KEY = 'acn_company_edited'
let migrated = false

function migrateLegacyEdits(): void {
  if (migrated) return
  migrated = true
  try {
    const edited = new Set<number>(JSON.parse(localStorage.getItem(LEGACY_EDITED_KEY) ?? '[]') as number[])
    for (const key of Object.keys(localStorage)) {
      const id = BASE_KEY.exec(key)?.[1]
      if (!id) continue
      const record = read(key)
      if (!record) continue
      const isUserWork = edited.has(Number(id)) || !!record.created_at
      if (isUserWork && localStorage.getItem(`${DRAFT_PREFIX}${id}`) === null) {
        localStorage.setItem(`${DRAFT_PREFIX}${id}`, localStorage.getItem(key)!)
        localStorage.removeItem(key)
      }
    }
    localStorage.removeItem(LEGACY_EDITED_KEY)
  } catch {
    // Unreadable or out of quota: leave everything where it was. The worst case
    // is an old edit showing as the base, which is how it behaved before.
  }
}

/** For tests: lets a suite that clears localStorage run the migration again. */
export function resetMigrationForTests(): void {
  migrated = false
}
