import { describe, it, expect } from 'vitest'
import {
  normalizeSelection,
  addCompany,
  removeCompany,
  setPrimaryIssuer,
} from './companies'
import type { CompanySelection } from './companies'

const TOYOTA = 91
const HONDA = 117
const MHI = 82

const selection = (company_ids: number[], primary_issuer_id: number | null): CompanySelection =>
  ({ company_ids, primary_issuer_id })

describe('normalizeSelection', () => {
  it('drops duplicates, keeping the first position', () => {
    expect(normalizeSelection([TOYOTA, HONDA, TOYOTA], TOYOTA).company_ids)
      .toEqual([TOYOTA, HONDA])
  })

  it('repairs an issuer that is not on the release', () => {
    expect(normalizeSelection([TOYOTA, HONDA], MHI).primary_issuer_id).toBe(TOYOTA)
  })

  it('fills in a missing issuer from the first company', () => {
    expect(normalizeSelection([HONDA, TOYOTA], null).primary_issuer_id).toBe(HONDA)
  })

  it('leaves the issuer null when there are no companies', () => {
    expect(normalizeSelection([], TOYOTA)).toEqual({ company_ids: [], primary_issuer_id: null })
  })

  it('keeps a legal issuer wherever it sits in the list', () => {
    expect(normalizeSelection([TOYOTA, HONDA, MHI], MHI).primary_issuer_id).toBe(MHI)
  })
})

describe('addCompany', () => {
  it('makes the first company added the primary issuer', () => {
    expect(addCompany(selection([], null), TOYOTA))
      .toEqual({ company_ids: [TOYOTA], primary_issuer_id: TOYOTA })
  })

  it('appends without disturbing the existing issuer', () => {
    expect(addCompany(selection([TOYOTA], TOYOTA), HONDA))
      .toEqual({ company_ids: [TOYOTA, HONDA], primary_issuer_id: TOYOTA })
  })

  it('ignores a company already on the release', () => {
    expect(addCompany(selection([TOYOTA, HONDA], HONDA), TOYOTA))
      .toEqual({ company_ids: [TOYOTA, HONDA], primary_issuer_id: HONDA })
  })
})

describe('removeCompany', () => {
  it('promotes the next company when the issuer is removed', () => {
    expect(removeCompany(selection([TOYOTA, HONDA, MHI], TOYOTA), TOYOTA))
      .toEqual({ company_ids: [HONDA, MHI], primary_issuer_id: HONDA })
  })

  it('leaves the issuer alone when a different company is removed', () => {
    expect(removeCompany(selection([TOYOTA, HONDA, MHI], TOYOTA), HONDA))
      .toEqual({ company_ids: [TOYOTA, MHI], primary_issuer_id: TOYOTA })
  })

  it('clears the issuer when the last company goes', () => {
    expect(removeCompany(selection([TOYOTA], TOYOTA), TOYOTA))
      .toEqual({ company_ids: [], primary_issuer_id: null })
  })

  it('is a no-op for a company that was never on the release', () => {
    expect(removeCompany(selection([TOYOTA], TOYOTA), MHI))
      .toEqual({ company_ids: [TOYOTA], primary_issuer_id: TOYOTA })
  })
})

describe('setPrimaryIssuer', () => {
  it('promotes a company already on the release', () => {
    expect(setPrimaryIssuer(selection([TOYOTA, HONDA], TOYOTA), HONDA))
      .toEqual({ company_ids: [TOYOTA, HONDA], primary_issuer_id: HONDA })
  })

  it('never promotes a company that is not on the release', () => {
    expect(setPrimaryIssuer(selection([TOYOTA, HONDA], TOYOTA), MHI).primary_issuer_id)
      .toBe(TOYOTA)
  })

  it('does not reorder the list — precedence is a flag, not a position', () => {
    expect(setPrimaryIssuer(selection([TOYOTA, HONDA, MHI], TOYOTA), MHI).company_ids)
      .toEqual([TOYOTA, HONDA, MHI])
  })
})
