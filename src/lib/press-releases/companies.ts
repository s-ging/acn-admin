// src/lib/press-releases/companies.ts
// The company list on a release, and the one company that takes precedence.
//
// Every company on a release carries equal weight — each contributes its sector
// to Industry. Exactly one of them is the **primary issuer**: whose release this
// ultimately is. That one sets the Sector and is the company shown on the canvas.
//
// Two invariants, enforced here and repaired on load by normalizeArticle:
//
//   1. `company_ids` holds no duplicates.
//   2. `primary_issuer_id` is null or a member of `company_ids` — never a
//      company that isn't on the release.
//
// Pure functions returning patches, same shape as derive.ts, so the store and
// the UI never hand-roll the rules.

import type { PressRelease } from '../../types/press-release.types'

export interface CompanySelectionPatch {
  company_ids: number[]
  primary_issuer_id: number | null
}

export type CompanySelection = Pick<PressRelease, 'company_ids' | 'primary_issuer_id'>

/**
 * Repairs any selection into a legal one.
 *
 * An issuer that isn't on the release falls back to the first company rather
 * than to null: a release with companies but no issuer can't derive a Sector at
 * all, so leaving it unset would be a worse state than picking the obvious one.
 */
export function normalizeSelection(
  companyIds: readonly number[],
  primaryIssuerId: number | null
): CompanySelectionPatch {
  const company_ids = [...new Set(companyIds)].filter(id => Number.isFinite(id))

  return {
    company_ids,
    primary_issuer_id:
      primaryIssuerId !== null && company_ids.includes(primaryIssuerId)
        ? primaryIssuerId
        : company_ids[0] ?? null,
  }
}

/** Adds a company. The first one added becomes the primary issuer. */
export function addCompany(selection: CompanySelection, id: number): CompanySelectionPatch {
  return normalizeSelection([...selection.company_ids, id], selection.primary_issuer_id)
}

/**
 * Removes a company. Removing the primary issuer promotes the first company
 * still on the release, so the Sector keeps deriving.
 */
export function removeCompany(selection: CompanySelection, id: number): CompanySelectionPatch {
  const company_ids = selection.company_ids.filter(c => c !== id)
  const stillIssuer = selection.primary_issuer_id === id ? null : selection.primary_issuer_id
  return normalizeSelection(company_ids, stillIssuer)
}

/** Promotes a company already on the release to primary issuer. */
export function setPrimaryIssuer(selection: CompanySelection, id: number): CompanySelectionPatch {
  return normalizeSelection(selection.company_ids, id)
}
