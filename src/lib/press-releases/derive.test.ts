import { describe, it, expect } from 'vitest'
import { resolveSector, deriveClassification, applyDerivedClassification } from './derive'
import type { SectorSource } from './derive'
import { SECTORS } from '../sectors'
import { createArticle } from './normalize'
import type { PressRelease } from '../../types/press-release.types'

// Sector ids from the master taxonomy, named so a failure reads as something
// other than a number.
const AUTOMOTIVE = 123      // Industrial
const MANUFACTURING = 91    // Industrial
const AI = 261              // Technology
const FINTECH = 257         // Financial

/** A company carrying exactly the sector the taxonomy holds for `sectorId`. */
function company(sectorId: number): SectorSource {
  const sector = SECTORS.find(s => s.id === sectorId)!
  return {
    sectors: [{
      id: 1,
      company_id: 1,
      sector_id: sector.id,
      sector_type: sector.sector_type,
      sector_name: sector.sector_name,
    }],
  }
}

/** A company whose denormalised strings are stale but whose sector_id is good. */
function legacyCompany(sectorId: number, staleType: string, staleName: string): SectorSource {
  return {
    sectors: [{ id: 1, company_id: 1, sector_id: sectorId, sector_type: staleType, sector_name: staleName }],
  }
}

const NO_SECTOR: SectorSource = { sectors: [] }

function article(patch: Partial<PressRelease> = {}): PressRelease {
  return { ...createArticle(1), ...patch }
}

describe('resolveSector', () => {
  it('returns null for a company with no sector', () => {
    expect(resolveSector(NO_SECTOR)).toBeNull()
  })

  it('returns null for a missing company', () => {
    expect(resolveSector(null)).toBeNull()
    expect(resolveSector(undefined)).toBeNull()
  })

  it('resolves through the master taxonomy, not the stored strings', () => {
    // Seeded records carry "Industry" where the taxonomy says "Industrial".
    expect(resolveSector(legacyCompany(AUTOMOTIVE, 'Industry', 'Automotive'))).toEqual({
      sector_type: 'Industrial',
      sector_name: 'Automotive',
    })
    expect(resolveSector(legacyCompany(FINTECH, 'Finance', 'FinTech'))).toEqual({
      sector_type: 'Financial',
      sector_name: 'FinTech',
    })
  })

  it('falls back to the stored strings for a sector the taxonomy does not know', () => {
    expect(resolveSector(legacyCompany(999999, 'Bespoke', 'Something New'))).toEqual({
      sector_type: 'Bespoke',
      sector_name: 'Something New',
    })
  })

  it('treats a sector with neither a known id nor stored strings as no sector', () => {
    expect(resolveSector(legacyCompany(999999, '', ''))).toBeNull()
  })
})

describe('deriveClassification', () => {
  it('takes the sector from the primary issuer and industries from every company', () => {
    // The worked example: Toyota (issuer) + Honda + Mitsubishi Heavy.
    const toyota = company(AUTOMOTIVE)
    const derived = deriveClassification({
      companies: [toyota, company(AUTOMOTIVE), company(MANUFACTURING)],
      primaryIssuer: toyota,
    })
    expect(derived).toEqual({
      sector_type: 'Industrial',
      industries: ['Automotive', 'Manufacturing'],
    })
  })

  it('dedupes industries and keeps them in list order', () => {
    const mhi = company(MANUFACTURING)
    const derived = deriveClassification({
      companies: [mhi, company(AUTOMOTIVE), company(MANUFACTURING)],
      primaryIssuer: mhi,
    })
    expect(derived.industries).toEqual(['Manufacturing', 'Automotive'])
  })

  it('follows the primary issuer when the selection spans categories', () => {
    // Datavault (Technology) is the issuer even though Toyota is listed first.
    const datavault = company(AI)
    const derived = deriveClassification({
      companies: [company(AUTOMOTIVE), datavault],
      primaryIssuer: datavault,
    })
    expect(derived.sector_type).toBe('Technology')
    expect(derived.industries).toEqual(['Automotive', 'Artificial Intel [AI]'])
  })

  it('does not care where the issuer sits in the list', () => {
    const mhi = company(MANUFACTURING)
    const first = deriveClassification({ companies: [mhi, company(AI)], primaryIssuer: mhi })
    const last = deriveClassification({ companies: [company(AI), mhi], primaryIssuer: mhi })
    expect(first.sector_type).toBe('Industrial')
    expect(last.sector_type).toBe('Industrial')
  })

  it('lets a company with no sector contribute nothing rather than guessing', () => {
    const derived = deriveClassification({
      companies: [NO_SECTOR, company(AUTOMOTIVE)],
      primaryIssuer: NO_SECTOR,
    })
    expect(derived).toEqual({ sector_type: null, industries: ['Automotive'] })
  })

  it('derives nothing at all from an empty selection', () => {
    expect(deriveClassification({ companies: [], primaryIssuer: null }))
      .toEqual({ sector_type: null, industries: [] })
    expect(deriveClassification({ companies: [NO_SECTOR], primaryIssuer: NO_SECTOR }))
      .toEqual({ sector_type: null, industries: [] })
  })

  it('still collects industries when there is no primary issuer', () => {
    const derived = deriveClassification({
      companies: [company(AUTOMOTIVE), company(AI)],
      primaryIssuer: null,
    })
    expect(derived.sector_type).toBeNull()
    expect(derived.industries).toEqual(['Automotive', 'Artificial Intel [AI]'])
  })
})

describe('applyDerivedClassification', () => {
  /** The common case: one company, which is therefore also the issuer. */
  const just = (source: SectorSource | null) => ({
    companies: source ? [source] : [],
    primaryIssuer: source,
  })

  it('fills in an unclassified release', () => {
    const toyota = company(AUTOMOTIVE)
    const patch = applyDerivedClassification(article(), {
      companies: [toyota, company(MANUFACTURING)],
      primaryIssuer: toyota,
    })
    expect(patch).toEqual({ sector_type: 'Industrial', industries: ['Automotive', 'Manufacturing'] })
  })

  it('returns an empty patch when the derivation already matches', () => {
    const current = article({ sector_type: 'Industrial', industries: ['Automotive'] })
    expect(applyDerivedClassification(current, just(company(AUTOMOTIVE)))).toEqual({})
  })

  it('patches only the field that actually changed', () => {
    const current = article({ sector_type: 'Industrial', industries: ['Manufacturing'] })
    expect(applyDerivedClassification(current, just(company(AUTOMOTIVE))))
      .toEqual({ industries: ['Automotive'] })

    const other = article({ sector_type: 'Technology', industries: ['Automotive'] })
    expect(applyDerivedClassification(other, just(company(AUTOMOTIVE))))
      .toEqual({ sector_type: 'Industrial' })
  })

  it('recomputes when the company selection changes', () => {
    const current = article({ sector_type: 'Industrial', industries: ['Automotive'] })
    expect(applyDerivedClassification(current, just(company(AI)))).toEqual({
      sector_type: 'Technology',
      industries: ['Artificial Intel [AI]'],
    })
  })

  it('recomputes the sector when precedence moves to another company', () => {
    const toyota = company(AUTOMOTIVE)
    const datavault = company(AI)
    const current = article({
      sector_type: 'Industrial',
      industries: ['Automotive', 'Artificial Intel [AI]'],
    })
    // Same companies, different issuer — only the sector moves.
    expect(applyDerivedClassification(current, {
      companies: [toyota, datavault],
      primaryIssuer: datavault,
    })).toEqual({ sector_type: 'Technology' })
  })

  it('clears the classification when the last company is removed', () => {
    const current = article({ sector_type: 'Industrial', industries: ['Automotive'] })
    expect(applyDerivedClassification(current, just(null)))
      .toEqual({ sector_type: null, industries: [] })
  })

  it('stops recomputing once the editor has overridden it', () => {
    const current = article({
      sector_type: 'Medicine',
      industries: ['Clinical Trials'],
      classification_overridden: true,
    })
    expect(applyDerivedClassification(current, just(company(AUTOMOTIVE)))).toEqual({})
  })

  it('resumes recomputing when the override is lifted', () => {
    const current = article({
      sector_type: 'Medicine',
      industries: ['Clinical Trials'],
      classification_overridden: false,
    })
    expect(applyDerivedClassification(current, just(company(AUTOMOTIVE)))).toEqual({
      sector_type: 'Industrial',
      industries: ['Automotive'],
    })
  })

  it('survives a record saved before industries existed', () => {
    const legacy = { ...article(), industries: undefined } as unknown as PressRelease
    expect(applyDerivedClassification(legacy, just(company(AUTOMOTIVE)))).toEqual({
      sector_type: 'Industrial',
      industries: ['Automotive'],
    })
  })
})
