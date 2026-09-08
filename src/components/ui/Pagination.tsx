// src/components/ui/Pagination.tsx
// The pager both list footers use.
//
// It has to work in two situations that differ in one important way:
//
//   companies — the whole set is in hand, so the total and the page count are
//               both known and it can say "Page 3 of 95" and offer Last.
//   releases  — only the current page is in hand. The total comes from
//               `countArticles`, and until that resolves there is no page count
//               at all, so Last is unavailable and "of N" is omitted rather
//               than guessed.
//
// Hence `totalPages` being optional: absent means "we don't know yet", which is
// a real state here and not the same as zero.

import { Button } from './Button'

interface PaginationProps {
  page: number
  onPage: (page: number) => void
  /** Absent while unknown — see the note above. */
  totalPages?: number | null
  /** Whether a next page exists. Used when `totalPages` is unknown. */
  hasMore?: boolean
  /** Disables the controls while a page is in flight. */
  busy?: boolean
}

export function Pagination({ page, onPage, totalPages, hasMore, busy }: PaginationProps) {
  const known = typeof totalPages === 'number' && totalPages > 0
  const canPrev = page > 1
  const canNext = known ? page < totalPages : !!hasMore

  return (
    <div className="pager" role="navigation" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={!canPrev || busy} onClick={() => onPage(1)}>
        « First
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!canPrev || busy}
        onClick={() => onPage(Math.max(1, page - 1))}
      >
        ‹ Prev
      </Button>

      <span className="pager__label">
        Page <strong>{page.toLocaleString()}</strong>
        {known && <> of {totalPages.toLocaleString()}</>}
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={!canNext || busy}
        onClick={() => onPage(page + 1)}
      >
        Next ›
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!known || page >= totalPages || busy}
        onClick={() => known && onPage(totalPages)}
      >
        Last »
      </Button>
    </div>
  )
}
