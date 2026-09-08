// src/lib/list/filters.ts
// Building and applying a column filter.
//
// Split out from <ColumnFilter> for the same reason as lib/list/alphabet.ts: the
// pages need these to compute the menus and to filter rows, and a component
// file that also exports functions breaks fast refresh.

export interface FilterOption {
  value: string
  /** How many rows carry this value, before this column's own filter applies. */
  count: number
}

/**
 * The distinct values of a column, with counts, ordered for a dropdown.
 *
 * Sorted by count descending then alphabetically: the values that actually
 * appear in the data come first, which on a sector list is the difference
 * between a useful menu and sixty alphabetical entries. A row contributing
 * several values (a company in two sectors) counts once against each.
 */
export function filterOptions<T>(
  rows: T[],
  get: (row: T) => string | string[] | null
): FilterOption[] {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const raw = get(row)
    const values = raw === null ? [] : Array.isArray(raw) ? raw : [raw]
    for (const value of new Set(values.filter(Boolean))) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

/**
 * Whether a row passes a column filter.
 *
 * An empty selection passes everything — that is what "no filter" means. A null
 * value fails a non-empty selection, because a row with no sector cannot be one
 * of the sectors asked for.
 */
export function passesFilter(selected: string[], value: string | string[] | null): boolean {
  if (selected.length === 0) return true
  if (value === null) return false
  const values = Array.isArray(value) ? value : [value]
  return values.some(v => selected.includes(v))
}
