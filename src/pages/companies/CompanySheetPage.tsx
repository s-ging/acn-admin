// src/pages/companies/CompanySheetPage.tsx
// The spreadsheet view of companies — an alternative surface onto the records
// the list and editor pages already own, not a replacement for them.
//
// Everything is in the shared <SheetView>; this route only names which records.

import { SheetView } from '../../components/sheet/SheetView'
import { companySheetSource } from '../../lib/companies/sheet'

export default function CompanySheetPage() {
  return <SheetView source={companySheetSource} />
}
