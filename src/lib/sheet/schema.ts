// src/lib/sheet/schema.ts
// The vocabulary a spreadsheet view is described in.
//
// A sheet view is a flat projection of a record type onto a grid. Everything
// specific to *which* records — companies, press releases — lives in that
// domain's own `sheet.ts`; this module and its siblings hold what both share.
//
// Two rules keep a projection honest, and both are enforced here rather than
// per-domain:
//
//  1. Column 0 is the record id and is never written by hand. It is also how a
//     row is identified at save time — the id is read out of the row that
//     changed rather than from a row-index map, so sorting, filtering and row
//     moves inside Univer cannot detach an edit from its record.
//  2. A column is either writable (`text` / `enum` / `langs`) or `derived`.
//     Derived columns are computed for display and refused on the way back in.
//     Nested collections have no flat cell representation, so they appear as
//     read-only summaries and stay editable only in the record editor.

export type SheetColumnKind = 'id' | 'text' | 'enum' | 'langs' | 'derived'

export interface SheetColumn<T> {
  /** Key on the record for writable kinds; a synthetic name for `derived`. */
  key: string
  header: string
  width: number
  kind: SheetColumnKind
  /** `enum` only — the accepted values. */
  options?: readonly string[]
  /** `derived` only — how to render a value the sheet cannot write back. */
  get?: (record: T) => string
}

/**
 * Everything a sheet view needs to know about one kind of record: how to lay it
 * out, and how to read, write and create it. The Univer side of the sheet is
 * written entirely against this, which is why companies and press releases
 * share one implementation.
 */
export interface SheetSource<T> {
  /** Shown in the breadcrumb and used as the worksheet name. */
  title: string
  /** Route to return to — the record list this sheet is an alternative to. */
  listRoute: string
  columns: readonly SheetColumn<T>[]
  load: () => T[]
  loadOne: (id: string) => T | null
  /** Persists a record. Returning a message marks the row as failed. */
  save: (record: T) => { ok: true } | { ok: false; message: string }
  /** A blank record carrying a fresh id. */
  create: () => T
  idOf: (record: T) => number
  /** Applied to every record on its way to `save` — bumps audit fields. */
  touch: (record: T) => T
  /** Ensures a newly created record is findable even if its name cell is empty. */
  ensureLabel: (record: T) => T
}

/** Column 0 holds the record id and carries row identity. */
export const ID_COLUMN = 0

/** Row 0 is the header. Data rows start at 1. */
export const HEADER_ROWS = 1

/** Blank rows kept below the data so a new record can be typed straight in. */
export const SPARE_ROWS = 200

/** True when a column accepts edits and should be written back to the record. */
export function isWritable<T>(column: SheetColumn<T>): boolean {
  return column.kind === 'text' || column.kind === 'enum' || column.kind === 'langs'
}
