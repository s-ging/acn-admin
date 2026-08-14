// src/lib/companies/normalize.ts
// Brings a company parsed from JSON up to the current shape.
//
// Companies come back from localStorage and from JSON import as whatever shape
// they were saved in, then get cast to CompanyFull. Fields added since a record
// was written are missing at runtime even though the type says otherwise, so
// every parse site runs the record through here first.

import { normalizeLanguageTags } from '../languages'
import type { CompanyFull } from '../../types/company.types'

export function normalizeCompany(company: CompanyFull): CompanyFull {
  return {
    ...company,
    // Fills in secondary_languages for records saved before it existed, and
    // collapses records that list several main languages down to one.
    ...normalizeLanguageTags(company),
  }
}
