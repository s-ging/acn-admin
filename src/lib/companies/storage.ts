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
