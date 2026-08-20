// src/lib/sheet/commit.ts
// Turns a batch of changed cells into saved records.
//
// This is the half of a sheet view that has nothing to do with Univer, and it is
// kept that way deliberately: it takes a plain list of dirty cell coordinates
// plus a reader for the grid, so it can be tested without mounting an engine and
// so swapping localStorage for the SQL Server API touches only the `SheetSource`
// passed in.
//
// Values are read from the grid at save time rather than captured when the edit
// happened. A cell touched five times before the user presses Save is one write
// carrying its final value, and there is no queue to keep coherent.
//
// Row identity is read out of the grid too. Column 0 holds the record id and
// travels with its row, so sorting, filtering or moving rows inside Univer
// cannot detach a pending edit from the record it belongs to.

import { HEADER_ROWS, ID_COLUMN } from './schema'
import { applyCellEdit } from './snapshot'
import type { SheetSource } from './schema'

/** A cell known to have been edited. Its value is read back at save time. */
export interface DirtyCell {
  row: number
  column: number
}

export interface CellRejectionAt {
  row: number
  column: number
  header: string
  reason: string
}

export interface CommitResult<T> {
  /** Records written, existing and new. */
  saved: T[]
  /** Rows that created a record, so the caller can write the id back. */
  created: { row: number; id: number }[]
  rejections: CellRejectionAt[]
}

/** Reads a cell out of the grid. Returns null/undefined for empty cells. */
export type CellReader = (row: number, column: number) => unknown

function asText(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

/**
 * Applies every dirty cell and saves each affected record.
 *
 * Cells are grouped by row, so a paste spanning twenty columns of one record is
 * a single write rather than twenty. A rejected cell does not abort its row —
 * the rest of the row still commits and the rejection comes back for the caller
 * to surface, which matches how a spreadsheet behaves: one bad cell should not
 * discard the other 499 in the paste.
 */
export function commitCells<T>(
  dirty: Iterable<DirtyCell>,
  read: CellReader,
  source: SheetSource<T>
): CommitResult<T> {
  const byRow = new Map<number, number[]>()
  for (const cell of dirty) {
    if (cell.row < HEADER_ROWS) continue
    const column = source.columns[cell.column]
    // The id column is dropped silently — it is how rows are identified and the
    // only writes to it are our own id write-backs. A derived column falls
    // through on purpose, so `applyCellEdit` can reject it with a message
    // pointing at the record editor rather than discarding what was typed.
    if (!column || column.kind === 'id') continue
    const columns = byRow.get(cell.row)
    if (columns) columns.push(cell.column)
    else byRow.set(cell.row, [cell.column])
  }

  const result: CommitResult<T> = { saved: [], created: [], rejections: [] }

  for (const [row, columnIndexes] of byRow) {
    const idText = asText(read(row, ID_COLUMN))

    let record: T
    let isNew = false

    if (idText === '') {
      // A blank id with content typed beside it means a new record. An edit that
      // only blanks cells on an empty row is just tidying — ignore it.
      const hasContent = columnIndexes.some(index => asText(read(row, index)) !== '')
      if (!hasContent) continue
      record = source.create()
      isNew = true
    } else {
      const existing = source.loadOne(idText)
      if (!existing) {
        result.rejections.push({
          row,
          column: ID_COLUMN,
          header: 'ID',
          reason: `No record with id ${idText} — the row may have been deleted elsewhere.`,
        })
        continue
      }
      record = existing
    }

    // Apply in column order so a row reads predictably if two cells disagree.
    let touched = false
    for (const columnIndex of [...columnIndexes].sort((a, b) => a - b)) {
      const column = source.columns[columnIndex]
      if (!column) continue
      const outcome = applyCellEdit(record, column, read(row, columnIndex))
      if (outcome !== null && typeof outcome === 'object' && 'reason' in outcome) {
        result.rejections.push({
          row,
          column: columnIndex,
          header: column.header,
          reason: (outcome as { reason: string }).reason,
        })
        continue
      }
      record = outcome as T
      touched = true
    }

    if (!touched) continue

    if (isNew) record = source.ensureLabel(record)
    record = source.touch(record)

    const outcome = source.save(record)
    if (!outcome.ok) {
      result.rejections.push({
        row,
        column: ID_COLUMN,
        header: 'ID',
        reason: outcome.message,
      })
      continue
    }

    result.saved.push(record)
    if (isNew) result.created.push({ row, id: source.idOf(record) })
  }

  return result
}
