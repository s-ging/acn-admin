// src/pages/companies/CompanySheetPage.tsx
// The spreadsheet view of companies — an alternative surface onto the records
// the list and editor pages already own, not a replacement for them.
//
// Everything is in the shared <SheetView>; this route only names which records.
//
// The records are fetched here rather than read from localStorage. `SheetSource.load`
// is synchronous — it is called inside the Univer boot — so the fetch happens
// first and `load` closes over the result. Nothing renders until the data is in
// hand, which also keeps the source object stable across the boot.

import { useMemo } from 'react'
import { SheetView } from '../../components/sheet/SheetView'
import { companySheetSource } from '../../lib/companies/sheet'
import { useAllCompanies } from '../../hooks/useRecords'

export default function CompanySheetPage() {
  const { data, isLoading } = useAllCompanies()

  const source = useMemo(
    () => (data ? { ...companySheetSource, load: () => data.records } : null),
    [data]
  )

  if (isLoading || !source) {
    return (
      <div className="companies-empty">
        <span>Loading all companies from the newswire…</span>
      </div>
    )
  }

  return <SheetView source={source} />
}
