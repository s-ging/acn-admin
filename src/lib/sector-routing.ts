// src/lib/sector-routing.ts
// Sector → wire code routing.
//
// Selecting a sector on a company auto-fills the Reuters and Bloomberg codes
// that sector always implies. Codes are keyed by sector id (see lib/sectors.ts)
// and every code must exist in the Reuters / Bloomberg master lists.
//
// This covers the *industry* codes a sector determines. Geographic codes (JP,
// ASIA, JAPAN …) and event codes (RES, MNA, IPO …) are not routed here — they
// depend on the company's country and on the individual release, so they stay
// manual in the Identifiers tab.
//
// A sector with no defensible code on one side is left empty on that side
// rather than mapped to a loose approximation.

import { wireCodeFromMaster } from './wire-codes'
import type { CompanyWireCode } from '../types/company.types'

export interface SectorRoute {
  reuters: string[]
  bloomberg: string[]
}

const NO_ROUTE: SectorRoute = { reuters: [], bloomberg: [] }

export const SECTOR_ROUTING: Record<number, SectorRoute> = {
  // ── Communications ──────────────────────────────────────────────────
  209: { reuters: ['ADV', 'PUB'],          bloomberg: ['ADV', 'MARKETING'] },      // Advertising
  184: { reuters: ['TBCS', 'PUB'],         bloomberg: ['TVNEWS', 'MED'] },         // Broadcast Film & Sat
  103: { reuters: ['PUB', 'ADV'],          bloomberg: ['MED', 'MARKETING'] },      // Media & Marketing
  26:  { reuters: ['TEL'],                 bloomberg: ['TLS', 'WRLS'] },           // Telecoms 5G
  183: { reuters: ['TEL', 'WWW'],          bloomberg: ['WRLS', 'MOBILE'] },        // Wireless Apps

  // ── Technology ──────────────────────────────────────────────────────
  261: { reuters: ['SFWR', 'SCI'],         bloomberg: ['AI', 'TEC'] },             // Artificial Intel [AI]
  262: { reuters: ['HDWR', 'SCI'],         bloomberg: ['IOT', 'TEC'] },            // Automation [IoT]
  243: { reuters: ['SFWR'],                bloomberg: ['ITSECURE', 'TEC'] },       // CyberSecurity
  240: { reuters: ['DPR', 'HDWR'],         bloomberg: ['CLOUD', 'HDWR'] },         // Datacenter & Cloud
  239: { reuters: ['SFWR', 'WWW'],         bloomberg: ['TEC', 'SOF'] },            // Digitalization
  86:  { reuters: ['ELC', 'ELI'],          bloomberg: ['ELE', 'SEM'] },            // Electronics
  30:  { reuters: ['MAC', 'IND'],          bloomberg: ['MAC', 'CST'] },            // Engineering
  190: { reuters: ['SFWR', 'DPR'],         bloomberg: ['SOF', 'ASFT'] },           // Enterprise IT
  203: { reuters: ['MIS', 'SCI'],          bloomberg: ['NANO', 'CHM'] },           // Materials & Nanotech

  // ── Sustainability ──────────────────────────────────────────────────
  244: { reuters: ['FOD', 'SCI'],          bloomberg: ['AGR', 'AGCH'] },           // Agritech
  232: { reuters: ['RNW', 'ENR'],          bloomberg: ['ALTNRG', 'NRG'] },         // Alternative Energy
  43:  { reuters: ['RNW', 'ENR'],          bloomberg: ['ALTNRG', 'NRG'] },         // Energy Alternatives
  250: { reuters: ['ENV'],                 bloomberg: ['ESG', 'SUSTAIN'] },        // Environment ESG
  245: { reuters: ['AUT'],                 bloomberg: ['PLUGINEV', 'AUT'] },       // EVs Transportation
  247: { reuters: ['CON', 'SCI'],          bloomberg: ['IOT', 'CST'] },            // Smart Cities
  212: { reuters: ['ELG', 'ENV'],          bloomberg: ['UTI', 'ENV'] },            // Water

  // ── Financial ───────────────────────────────────────────────────────
  215: { reuters: ['BNK', 'INS'],          bloomberg: ['BNK', 'INS'] },            // Banking & Insurance
  94:  { reuters: ['FIN', 'BNK'],          bloomberg: ['CARD', 'FIN'] },           // Cards & Payments
  108: { reuters: ['FIN'],                 bloomberg: ['FINANCE', 'FIN'] },        // Daily Finance
  92:  { reuters: ['EXCA', 'SFWR'],        bloomberg: ['EXC', 'SCR'] },            // Exchanges & Software
  257: { reuters: ['FIN', 'SFWR'],         bloomberg: ['FINTECH', 'FIN'] },        // FinTech
  213: { reuters: ['FUND', 'INV'],         bloomberg: ['FND', 'ALLFND'] },         // Funds & Equities
  233: { reuters: ['LAW', 'JUDIC'],        bloomberg: ['LAW', 'CORPGOV'] },        // Legal & Compliance
  216: { reuters: ['PVE'],                 bloomberg: ['PE', 'VC'] },              // PE VC & Alternatives
  113: { reuters: ['REA'],                 bloomberg: ['CRE', 'REIT'] },           // Real Estate & REIT
  248: { reuters: ['TRD', 'LOA'],          bloomberg: ['TRD', 'LOANS'] },          // Trade Finance

  // ── Industrial ──────────────────────────────────────────────────────
  211: { reuters: ['AER', 'DEF'],          bloomberg: ['ARO', 'SPACE'] },          // Aerospace & Defence
  171: { reuters: ['AIR'],                 bloomberg: ['AIR', 'TRN'] },            // Airlines
  123: { reuters: ['AUT'],                 bloomberg: ['AUT', 'AUP'] },            // Automotive
  204: { reuters: ['CHE'],                 bloomberg: ['CHM', 'SPCH'] },           // Chemicals Spec.Chem
  33:  { reuters: ['CON', 'BLD'],          bloomberg: ['CST'] },                   // Construct Engineering
  256: { reuters: ['CHE', 'LUX'],          bloomberg: ['SPCH', 'HOU'] },           // Cosmetics Spec.Chem
  77:  { reuters: ['FOD', 'BEV'],          bloomberg: ['FOD', 'BVG'] },            // Food & Beverage
  91:  { reuters: ['IND', 'MAC'],          bloomberg: ['MAC'] },                   // Manufacturing
  185: { reuters: ['SHP'],                 bloomberg: ['MAR', 'SHP'] },            // Marine & Offshore
  99:  { reuters: ['MET', 'GDM'],          bloomberg: ['MET', 'MNG'] },            // Metals & Mining
  101: { reuters: ['ENR', 'NGS'],          bloomberg: ['OIL', 'GAS'] },            // Oil & Gas
  157: { reuters: ['TIM', 'PUB'],          bloomberg: ['MAC'] },                   // Print & Package
  152: { reuters: ['RRL', 'SHP'],          bloomberg: ['TRN', 'RAI'] },            // Transport & Logistics

  // ── Medicine ────────────────────────────────────────────────────────
  196: { reuters: ['HEA', 'DRU'],          bloomberg: ['HEA', 'DRG'] },            // Alternative
  176: { reuters: ['BIO'],                 bloomberg: ['BTC', 'MEDICAL'] },        // BioTech
  249: { reuters: ['DRU', 'HEA'],          bloomberg: ['CLNTRIAL', 'MEDICAL'] },   // Clinical Trials
  97:  { reuters: ['DRU', 'HEA'],          bloomberg: ['HEA', 'DRG'] },            // Healthcare & Pharm
  246: { reuters: ['BIO', 'DRU'],          bloomberg: ['MTC', 'MDS'] },            // MedTech

  // ── Lifestyle ───────────────────────────────────────────────────────
  207: { reuters: ['ENT', 'MUSIC'],        bloomberg: ['ART', 'MUSIC'] },          // Art Music & Design
  255: { reuters: ['LUX', 'RET'],          bloomberg: ['HOU', 'CONS'] },           // Beauty & Skin Care
  241: { reuters: ['LEI', 'SHP'],          bloomberg: ['LEI', 'MAR'] },            // Boating
  122: { reuters: ['EDU'],                 bloomberg: ['EDU'] },                   // Education
  252: { reuters: ['GSFT', 'REC'],         bloomberg: ['GAMES', 'SPORTS'] },       // eSports Gaming
  208: { reuters: ['TEX', 'LUX'],          bloomberg: ['CLO', 'TEX'] },            // Fashion & Apparel
  174: { reuters: ['LEI'],                 bloomberg: ['LOD', 'LEI'] },            // Hospitality
  242: { reuters: ['REC', 'AUT'],          bloomberg: ['FORMULA1', 'SPORTS'] },    // Motorsports
  253: NO_ROUTE,                                                                   // Regional — no industry code
  206: { reuters: ['RET', 'WWW'],          bloomberg: ['RET', 'ECOM'] },           // Retail & eCommerce
  191: { reuters: ['REC'],                 bloomberg: ['SPORTS', 'SPORTBIZ'] },    // Sports
  155: { reuters: ['LEI'],                 bloomberg: ['TRAVEL', 'LEI'] },         // Travel & Tourism
  254: { reuters: ['LUX', 'RET'],          bloomberg: ['CONS'] },                  // Watches & Jewelry

  // ── Business ────────────────────────────────────────────────────────
  223: { reuters: ['ASIA'],                bloomberg: ['SEASIA', 'ASIA'] },        // ASEAN
  187: { reuters: ['BACT'],                bloomberg: ['GEN', 'COS'] },            // Daily News
  238: { reuters: ['POL'],                 bloomberg: ['GOV'] },                   // Government
  200: { reuters: ['JOB'],                 bloomberg: ['HR'] },                    // HR
  234: { reuters: ['BACT'],                bloomberg: ['COS'] },                   // Local Biz
  263: { reuters: ['BACT', 'BUS'],         bloomberg: ['COS', 'SMALLCAP'] },       // SMEs
  251: { reuters: ['STINV'],               bloomberg: ['STARTUPS', 'VC'] },        // Startups
  28:  { reuters: ['BACT'],                bloomberg: ['SHOW'] },                  // Trade Shows

  // ── CryptoCurrency ──────────────────────────────────────────────────
  214: { reuters: ['BLKCHN'],              bloomberg: ['BLOCKCHAIN'] },            // Blockchain Technology
  202: { reuters: ['CRYCUR', 'EXCA'],      bloomberg: ['CRYPTOMKT', 'DIGITALCUR'] }, // Crypto Exchange
  237: { reuters: ['CRYCUR', 'ISU'],       bloomberg: ['ICO', 'DIGITALCUR'] },     // ICOs & Tokens
  260: { reuters: ['GSFT'],                bloomberg: ['GAMES', 'VIRTUALR'] },     // Metaverse Games
  258: { reuters: ['CRYCUR'],              bloomberg: ['CRYPTOMKT', 'DIGITALCUR'] }, // Mining & Staking
  259: { reuters: ['CRYCUR'],              bloomberg: ['NFT', 'DIGITALCUR'] },     // NFTs
}

export function getSectorRoute(sectorId: number | null): SectorRoute {
  if (sectorId === null) return NO_ROUTE
  return SECTOR_ROUTING[sectorId] ?? NO_ROUTE
}

/**
 * Reconciles a company's wire codes against a sector change.
 *
 * Adds every code the incoming sector routes to and drops the codes the
 * outgoing sector had put there, so switching sectors doesn't accumulate stale
 * codes. Codes outside both routes — anything added by hand, and all geographic
 * codes — are left alone. Returns the original array when nothing changes, so
 * this never marks the draft dirty on its own.
 */
export function applySectorRouting(
  wireCodes: CompanyWireCode[],
  companyId: number,
  previousSectorId: number | null,
  nextSectorId: number | null
): CompanyWireCode[] {
  const previous = getSectorRoute(previousSectorId)
  const next = getSectorRoute(nextSectorId)

  const nextReuters = new Set(next.reuters)
  const nextBloomberg = new Set(next.bloomberg)
  const staleReuters = new Set(previous.reuters.filter(c => !nextReuters.has(c)))
  const staleBloomberg = new Set(previous.bloomberg.filter(c => !nextBloomberg.has(c)))

  const kept = wireCodes.filter(w => {
    if (w.wire_code.source === 'reuters') return !staleReuters.has(w.wire_code.code)
    if (w.wire_code.source === 'bloomberg') return !staleBloomberg.has(w.wire_code.code)
    return true
  })

  const present = (source: string) =>
    new Set(kept.filter(w => w.wire_code.source === source).map(w => w.wire_code.code))
  const haveReuters = present('reuters')
  const haveBloomberg = present('bloomberg')

  const added: CompanyWireCode[] = []
  for (const code of next.reuters) {
    if (haveReuters.has(code)) continue
    const row = wireCodeFromMaster('reuters', code, companyId)
    if (row) added.push(row)
  }
  for (const code of next.bloomberg) {
    if (haveBloomberg.has(code)) continue
    const row = wireCodeFromMaster('bloomberg', code, companyId)
    if (row) added.push(row)
  }

  if (added.length === 0 && kept.length === wireCodes.length) return wireCodes
  return [...kept, ...added]
}
