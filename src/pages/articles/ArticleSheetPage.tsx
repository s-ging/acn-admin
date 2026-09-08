// src/pages/articles/ArticleSheetPage.tsx
// The spreadsheet view of press releases — the same alternative surface the
// companies list has, over the records the release editor owns.
//
// One page of releases, not all of them: there are 78,874 on the wire, and a
// sheet is a bulk-edit surface rather than a browsing one. The companies sheet
// can hold its whole set (9,439); this one deliberately does not try.
//
// Same fetch-then-boot arrangement as CompanySheetPage — see the note there.

import { useMemo } from 'react'
import { SheetView } from '../../components/sheet/SheetView'
import { pressReleaseSheetSource } from '../../lib/press-releases/sheet'
import { useArticlePage } from '../../hooks/useRecords'

/** The server caps a page at 100, and 100 rows is a workable sheet. */
const SHEET_PAGE_SIZE = 100

export default function ArticleSheetPage() {
  const { data, isLoading } = useArticlePage({ page: 1, size: SHEET_PAGE_SIZE })

  const source = useMemo(
    () => (data ? { ...pressReleaseSheetSource, load: () => data.records } : null),
    [data]
  )

  if (isLoading || !source) {
    return (
      <div className="companies-empty">
        <span>Loading press releases from the newswire…</span>
      </div>
    )
  }

  return <SheetView source={source} />
}
