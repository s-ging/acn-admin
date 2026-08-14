import { describe, it, expect } from 'vitest'
import { SECTOR_ROUTING, getSectorRoute, applySectorRouting } from './sector-routing'
import { SECTORS } from './sectors'
import { codeHash, lookupWireCode } from './wire-codes'
import type { CompanyWireCode } from '../types/company.types'

const COMPANY_ID = 82

// Sector ids used below, named so a failure reads as something other than a number.
const OIL_AND_GAS = 101          // R: ENR, NGS  / B: OIL, GAS
const FINTECH = 257              // R: FIN, SFWR / B: FINTECH, FIN
const DAILY_FINANCE = 108        // R: FIN       / B: FINANCE, FIN
const ALTERNATIVE_ENERGY = 232   // identical route to ENERGY_ALTERNATIVES
const ENERGY_ALTERNATIVES = 43
const REGIONAL = 253             // deliberately routes to nothing

function manualCode(source: 'reuters' | 'bloomberg', code: string, name: string): CompanyWireCode {
  const id = codeHash(code)
  return {
    id,
    company_id: COMPANY_ID,
    wire_code_id: id,
    wire_code: { id, source, code_type: 'Geographic', code, name },
  }
}

const codesOf = (rows: CompanyWireCode[], source: string) =>
  rows.filter(r => r.wire_code.source === source).map(r => r.wire_code.code).sort()

describe('routing table integrity', () => {
  it('covers every sector in the taxonomy exactly once', () => {
    const routed = Object.keys(SECTOR_ROUTING).map(Number)
    const taxonomy = SECTORS.map(s => s.id)
    expect(new Set(routed)).toEqual(new Set(taxonomy))
    expect(routed.length).toBe(taxonomy.length)
  })

  it('only references codes that exist in the Reuters and Bloomberg master lists', () => {
    const unknown: string[] = []
    for (const [sectorId, route] of Object.entries(SECTOR_ROUTING)) {
      const name = SECTORS.find(s => s.id === Number(sectorId))?.sector_name ?? sectorId
      for (const code of route.reuters) {
        if (!lookupWireCode('reuters', code)) unknown.push(`${name}: reuters ${code}`)
      }
      for (const code of route.bloomberg) {
        if (!lookupWireCode('bloomberg', code)) unknown.push(`${name}: bloomberg ${code}`)
      }
    }
    expect(unknown).toEqual([])
  })

  it('never routes the same code twice within one sector', () => {
    for (const [sectorId, route] of Object.entries(SECTOR_ROUTING)) {
      expect(new Set(route.reuters).size, `reuters dupes on sector ${sectorId}`).toBe(route.reuters.length)
      expect(new Set(route.bloomberg).size, `bloomberg dupes on sector ${sectorId}`).toBe(route.bloomberg.length)
    }
  })

  it('returns an empty route for an unknown or null sector', () => {
    expect(getSectorRoute(null)).toEqual({ reuters: [], bloomberg: [] })
    expect(getSectorRoute(999999)).toEqual({ reuters: [], bloomberg: [] })
  })
})

describe('applySectorRouting', () => {
  it('fills in both wires when a sector is picked on a company with no codes', () => {
    const result = applySectorRouting([], COMPANY_ID, null, OIL_AND_GAS)
    expect(codesOf(result, 'reuters')).toEqual(['ENR', 'NGS'])
    expect(codesOf(result, 'bloomberg')).toEqual(['GAS', 'OIL'])
  })

  it('populates each row from the master list, not from the bare code', () => {
    const [row] = applySectorRouting([], COMPANY_ID, null, OIL_AND_GAS)
    expect(row.wire_code.name).toBe('Energy & Resources')
    expect(row.wire_code.code_type).toBe('Industrial Sector')
    expect(row.company_id).toBe(COMPANY_ID)
  })

  it('gives a routed code the same wire_code_id a hand-added one would get', () => {
    const [row] = applySectorRouting([], COMPANY_ID, null, OIL_AND_GAS)
    expect(row.wire_code_id).toBe(codeHash(row.wire_code.code))
  })

  it('drops the outgoing sector codes and keeps the ones both sectors share', () => {
    const withFintech = applySectorRouting([], COMPANY_ID, null, FINTECH)
    const switched = applySectorRouting(withFintech, COMPANY_ID, FINTECH, DAILY_FINANCE)

    // SFWR was FinTech-only and goes; FIN is on both routes and survives.
    expect(codesOf(switched, 'reuters')).toEqual(['FIN'])
    expect(codesOf(switched, 'bloomberg')).toEqual(['FIN', 'FINANCE'])
  })

  it('does not re-add a shared code as a second row', () => {
    const withFintech = applySectorRouting([], COMPANY_ID, null, FINTECH)
    const switched = applySectorRouting(withFintech, COMPANY_ID, FINTECH, DAILY_FINANCE)
    const finRows = switched.filter(r => r.wire_code.source === 'bloomberg' && r.wire_code.code === 'FIN')
    expect(finRows).toHaveLength(1)
  })

  it('leaves geographic and hand-added codes alone', () => {
    const manual = [
      manualCode('reuters', 'JP', 'Japan'),
      manualCode('bloomberg', 'JAPAN', 'Japan'),
      manualCode('reuters', 'NEWR', 'News Releases'),
    ]
    const filled = applySectorRouting(manual, COMPANY_ID, null, OIL_AND_GAS)
    const cleared = applySectorRouting(filled, COMPANY_ID, OIL_AND_GAS, null)

    expect(codesOf(cleared, 'reuters')).toEqual(['JP', 'NEWR'])
    expect(codesOf(cleared, 'bloomberg')).toEqual(['JAPAN'])
  })

  it('removes the routed codes when the sector is cleared', () => {
    const filled = applySectorRouting([], COMPANY_ID, null, OIL_AND_GAS)
    expect(applySectorRouting(filled, COMPANY_ID, OIL_AND_GAS, null)).toEqual([])
  })

  it('does not duplicate a routed code the user had already added by hand', () => {
    const existing = [manualCode('bloomberg', 'OIL', 'Oil')]
    const result = applySectorRouting(existing, COMPANY_ID, null, OIL_AND_GAS)
    expect(codesOf(result, 'bloomberg')).toEqual(['GAS', 'OIL'])
    expect(result.filter(r => r.wire_code.code === 'OIL')).toHaveLength(1)
    // the row the user added is the one kept, untouched
    expect(result.find(r => r.wire_code.code === 'OIL')).toBe(existing[0])
  })

  it('returns the original array when the switch changes nothing', () => {
    const filled = applySectorRouting([], COMPANY_ID, null, ALTERNATIVE_ENERGY)
    const same = applySectorRouting(filled, COMPANY_ID, ALTERNATIVE_ENERGY, ENERGY_ALTERNATIVES)
    expect(same).toBe(filled) // identity, so the draft is not marked dirty
  })

  it('adds nothing for a sector with no route', () => {
    const manual = [manualCode('reuters', 'JP', 'Japan')]
    expect(applySectorRouting(manual, COMPANY_ID, null, REGIONAL)).toBe(manual)
  })

  it('does not mutate the array it was given', () => {
    const manual = [manualCode('reuters', 'JP', 'Japan')]
    const before = [...manual]
    applySectorRouting(manual, COMPANY_ID, null, OIL_AND_GAS)
    expect(manual).toEqual(before)
  })

  it('round-trips every sector: select then clear returns to the starting codes', () => {
    const start = [manualCode('reuters', 'JP', 'Japan'), manualCode('bloomberg', 'JAPAN', 'Japan')]
    for (const sector of SECTORS) {
      const filled = applySectorRouting(start, COMPANY_ID, null, sector.id)
      const cleared = applySectorRouting(filled, COMPANY_ID, sector.id, null)
      expect(codesOf(cleared, 'reuters'), sector.sector_name).toEqual(['JP'])
      expect(codesOf(cleared, 'bloomberg'), sector.sector_name).toEqual(['JAPAN'])
    }
  })

  it('never accumulates codes when walking through every sector in turn', () => {
    let codes: CompanyWireCode[] = []
    let previous: number | null = null
    for (const sector of SECTORS) {
      codes = applySectorRouting(codes, COMPANY_ID, previous, sector.id)
      previous = sector.id
      const route = getSectorRoute(sector.id)
      expect(codesOf(codes, 'reuters'), sector.sector_name).toEqual([...route.reuters].sort())
      expect(codesOf(codes, 'bloomberg'), sector.sector_name).toEqual([...route.bloomberg].sort())
    }
  })
})
