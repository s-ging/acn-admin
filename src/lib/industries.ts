// src/lib/industries.ts
// The wire's industry taxonomy — the id space of
// PUT/DELETE /api/Companies/{companyId}/industries/{industryId}.
//
// It is NOT lib/sectors.ts and NOT /api/Sectors: those are sectors, which have
// no write endpoint. No endpoint lists industries, so this was read off the
// write responses on the dev host (2026-10-19, ids 1–99 probed; 42 is unused).

export interface Industry {
  id: number
  name: string
}

export const INDUSTRIES: Industry[] = [
  { id: 1, name: 'None' },
  { id: 2, name: 'Aerospace & Defense' },
  { id: 3, name: 'Agriculture' },
  { id: 4, name: 'Air Transport' },
  { id: 5, name: 'Alternative Energy' },
  { id: 6, name: 'Automotive' },
  { id: 7, name: 'Banks & Insurance' },
  { id: 8, name: 'Beverages' },
  { id: 9, name: 'Biotechnology' },
  { id: 10, name: 'Broadcasting' },
  { id: 11, name: 'Building & Construction' },
  { id: 12, name: 'Business & Support Services' },
  { id: 13, name: 'Chemicals' },
  { id: 14, name: 'Communications Technology' },
  { id: 15, name: 'Computers, IT & Internet' },
  { id: 16, name: 'Consumer & Retail Products' },
  { id: 17, name: 'Consumer Services' },
  { id: 18, name: 'Electrical Machinery' },
  { id: 19, name: 'Electronics & Equipment' },
  { id: 20, name: 'Energy' },
  { id: 21, name: 'Environment' },
  { id: 22, name: 'Financial Services' },
  { id: 23, name: 'Foods' },
  { id: 24, name: 'Healthcare' },
  { id: 25, name: 'Heavy Industry' },
  { id: 26, name: 'Industrial' },
  { id: 27, name: 'Industrial & Manufacturing' },
  { id: 28, name: 'Leisure & Entertainment' },
  { id: 29, name: 'Media & Advertising' },
  { id: 30, name: 'Medical Products' },
  { id: 31, name: 'Mining & Metals' },
  { id: 32, name: 'Pharmaceutical' },
  { id: 33, name: 'Printing & Publishing' },
  { id: 34, name: 'Real Estate' },
  { id: 35, name: 'Retail' },
  { id: 36, name: 'Software' },
  { id: 37, name: 'Telecommunications' },
  { id: 38, name: 'Textiles & Apparel' },
  { id: 39, name: 'Transportation' },
  { id: 40, name: 'Utilities' },
  { id: 41, name: 'Wireless Communications' },
  { id: 43, name: 'Security' },
  { id: 44, name: 'Nanotechnology' },
]

export const industryName = (id: number): string =>
  INDUSTRIES.find(i => i.id === id)?.name ?? `Industry ${id}`
