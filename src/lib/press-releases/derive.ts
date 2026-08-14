// src/lib/press-releases/derive.ts
// Sector and Industry, derived from the companies responsible for a release.
//
// Nobody picks these. A release about Toyota cannot be mis-filed under
// Healthcare, because the classification is a consequence of the company
// selection rather than a judgement call made alongside it:
//
//   Sector    ← sector_type of the PRIMARY ISSUER only
//   Industry  ← sector_name of EVERY company on the release, deduped, in list order
//
// Worked example — Toyota (Automotive) + Honda (Automotive) + Mitsubishi Heavy
// (Manufacturing), with Toyota the primary issuer:
//
//   Sector: Industrial · Industry: Automotive, Manufacturing
//
// Three decided edge cases:
//
//   Companies span different categories  → Sector follows the primary issuer.
//                                          Industry still collects from all.
//   A selected company has no sector     → contributes nothing. Never guess.
//   The editor disagrees                 → classification_overridden = true stops
//                                          recomputation and hands the fields over.
//
// Pure functions, same shape as applySectorRouting: they take the current state
// and return a patch, and return an empty patch when nothing changes so they
// never mark a draft dirty on their own.

import { SECTORS } from '../sectors'
import type { CompanySector } from '../../types/company.types'
import type { PressRelease } from '../../types/press-release.types'

// Anything carrying a company's sector list. Narrower than CompanyFull so the
// tests can build a source in one line.
export interface SectorSource {
  sectors: CompanySector[]
}

export interface DerivedClassification {
  sector_type: string | null
  industries: string[]
}

/**
 * The companies a release is derived from, already resolved from ids.
 *
 * Passed as an object rather than two positional arguments on purpose: both
 * sides are company-shaped, so positional args invite a silent arg-order bug.
 */
export interface CompanySelection {
  /** Every company on the release, in list order. All contribute to Industry. */
  companies: SectorSource[]
  /** The one that takes precedence. Sets the Sector. */
  primaryIssuer: SectorSource | null
}

export interface ResolvedSector {
  sector_type: string
  sector_name: string
}

/**
 * A company's sector, resolved against the master taxonomy in lib/sectors.ts.
 *
 * `sector_id` is the stable key; the `sector_type` / `sector_name` strings
 * stored alongside it on a company are a denormalised copy that predates the
 * current taxonomy and can be stale — records exist carrying "Industry" where
 * the taxonomy now says "Industrial", and "Finance" where it says "Financial".
 * Resolving through the master list keeps the derived Sector on the taxonomy's
 * terms; the stored strings are the fallback for a sector the list doesn't know.
 *
 * A company holds at most one sector (see MetadataPanel), so `sectors[0]` is
 * that sector rather than an arbitrary pick.
 */
export function resolveSector(source: SectorSource | null | undefined): ResolvedSector | null {
  const stored = source?.sectors?.[0]
  if (!stored) return null

  const master = SECTORS.find(s => s.id === stored.sector_id)
  const sector_type = master?.sector_type ?? stored.sector_type ?? ''
  const sector_name = master?.sector_name ?? stored.sector_name ?? ''

  if (!sector_type && !sector_name) return null
  return { sector_type, sector_name }
}

/**
 * The classification implied by a company selection.
 *
 * `primaryIssuer` may be null — an unfiled release, or one whose companies have
 * all been removed. Industry still collects from whatever companies remain,
 * because they are genuinely responsible for the release; only Sector is left
 * empty, since there is no issuer to take it from.
 */
export function deriveClassification({
  companies,
  primaryIssuer,
}: CompanySelection): DerivedClassification {
  const industries: string[] = []

  for (const source of companies) {
    const sector = resolveSector(source)
    if (!sector?.sector_name) continue
    if (!industries.includes(sector.sector_name)) industries.push(sector.sector_name)
  }

  return {
    sector_type: resolveSector(primaryIssuer)?.sector_type || null,
    industries,
  }
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i])

/**
 * The patch that brings a release's classification back in line with its
 * companies. Empty when the release is overridden, and empty when the
 * derivation already matches what is stored — so calling this on every update
 * costs nothing and never dirties a draft by itself.
 */
export function applyDerivedClassification(
  article: PressRelease,
  selection: CompanySelection
): Partial<PressRelease> {
  if (article.classification_overridden) return {}

  const derived = deriveClassification(selection)
  const patch: Partial<PressRelease> = {}

  if (derived.sector_type !== article.sector_type) patch.sector_type = derived.sector_type
  if (!sameList(derived.industries, article.industries ?? [])) patch.industries = derived.industries

  return patch
}
