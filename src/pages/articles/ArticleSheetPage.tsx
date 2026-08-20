// src/pages/articles/ArticleSheetPage.tsx
// The spreadsheet view of press releases — the same alternative surface the
// companies list has, over the records the release editor owns.

import { SheetView } from '../../components/sheet/SheetView'
import { pressReleaseSheetSource } from '../../lib/press-releases/sheet'

export default function ArticleSheetPage() {
  return <SheetView source={pressReleaseSheetSource} />
}
