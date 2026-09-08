// src/lib/companies/storage.ts
// localStorage access for companies, under acn_company_{id}. Every read
// normalises. The press release editor needs the same list the companies page
// builds, so the loader lives here rather than being copied into both.

import { normalizeCompany } from './normalize'
import type { CompanyFull } from '../../types/company.types'

const PREFIX = 'acn_company_'

export function loadCompanies(): CompanyFull[] {
  return Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .map(k => {
      try { return normalizeCompany(JSON.parse(localStorage.getItem(k) || '') as CompanyFull) }
      catch { return null }
    })
    .filter(Boolean) as CompanyFull[]
}

export function loadCompany(id: string | number | null): CompanyFull | null {
  if (id === null || id === '') return null
  const stored = localStorage.getItem(`${PREFIX}${id}`)
  if (!stored) return null
  try { return normalizeCompany(JSON.parse(stored) as CompanyFull) }
  catch { return null }
}

/**
 * Writes a company back under its key. The spreadsheet view commits through
 * here so the sheet and the record editor stay pointed at the same records;
 * when the SQL Server API lands this is the single function that changes.
 */
export function saveCompany(company: CompanyFull): void {
  localStorage.setItem(`${PREFIX}${company.id}`, JSON.stringify(company))
  // Records the edit so a later API fetch can't overwrite it — see cacheCompany.
  markEdited(company.id)
}

/** The next free company id, matching how the list page allocates one. */
export function nextCompanyId(): number {
  const ids = Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .map(k => {
      const parsed = parseInt(k.slice(PREFIX.length), 10)
      return isNaN(parsed) ? 0 : parsed
    })
  return (ids.length > 0 ? Math.max(...ids) : 999) + 1
}

// ── The API overlay ─────────────────────────────────────────────────────────
//
// Reads now have two possible origins: the ACN Newswire API (lib/api), which is
// read-only — every operation in the swagger document is a GET — and this
// localStorage layer, which is the only place an edit can go.
//
// So localStorage plays two roles at once: a cache of what the API said, and
// the record of what someone changed. `cacheCompany` keeps those apart. It
// writes an API record into the same keyspace the editor reads from, but never
// over a company that has been edited here — otherwise a page refresh would
// quietly revert the last edit to whatever the wire still says.

const EDITED_KEY = 'acn_company_edited'

function editedIds(): Set<number> {
  try {
    const raw = localStorage.getItem(EDITED_KEY)
    return new Set(raw ? (JSON.parse(raw) as number[]) : [])
  } catch {
    return new Set()
  }
}

/** Whether this company carries local edits that the API must not overwrite. */
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
    // Out of quota. The company itself is already written, which is the part
    // that matters; the worst case is that a later fetch overwrites it.
  }
}

/**
 * Stores a company fetched from the API, unless it has been edited locally.
 *
 * Returns the record the editor should actually use: the local one when it wins,
 * so a caller can hydrate and render in one step without re-reading.
 */
export function cacheCompany(company: CompanyFull): CompanyFull {
  if (isLocallyEdited(company.id)) {
    return loadCompany(company.id) ?? company
  }
  try {
    localStorage.setItem(`${PREFIX}${company.id}`, JSON.stringify(company))
  } catch {
    // Quota. Caching is best-effort — the caller still has the fetched record.
  }
  return company
}

// There is deliberately no `cacheCompanies` for a whole list.
//
// The wire holds 9,439 companies, which is ~16.7 MB as CompanyFull records
// (1,856 bytes each, measured) against an origin cap of roughly 5 MB. A bulk
// write would throw a third of the way through and leave an arbitrary partial
// subset cached, which is worse than caching nothing. Lists are held in memory
// by React Query instead — see lib/api/repository.ts — and only records opened
// in an editor are cached individually, which is bounded by how many someone
// opens.
