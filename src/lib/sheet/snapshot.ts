// src/lib/sheet/snapshot.ts
// Moves records across the projection described by `schema.ts`: a record list
// out to a Univer workbook snapshot, and a single edited cell back onto a record.
//
// Univer holds a whole workbook in memory — there is no windowed data source —
// so the snapshot built here is the entire dataset. At the ~10k companies this
// portal carries that is roughly 0.9MB of JSON and well inside what the engine
// handles; it is the reason a sheet is a separate route rather than something
// mounted alongside a list page.

import { LANGUAGES, normalizeLanguageTags } from '../languages'
import { HEADER_ROWS, SPARE_ROWS, isWritable } from './schema'
import type { SheetColumn } from './schema'
import type { LanguageCode } from '../../types/company.types'

const LANGUAGE_CODES = LANGUAGES.map(l => l.code)

/**
 * The font cells render in.
 *
 * Univer's chrome already picks up Inter, because it inherits `--font-sans` from
 * index.css like everything else. Cells do not: they are drawn on a canvas from
 * the workbook's own style data, whose default is Arial. Setting it here is what
 * makes the grid match the rest of the app.
 *
 * Inter is loaded once for the whole app by the Google Fonts import at the top of
 * index.css, so there is nothing extra to fetch.
 */
export const SHEET_FONT = 'Inter'

/** A cell value refused by `applyCellEdit`, with the reason to show the user. */
export interface CellRejection {
  reason: string
}

/** The `languages` / `secondary_languages` pair both record types carry. */
interface HasLanguages {
  languages: LanguageCode[]
  secondary_languages: LanguageCode[]
}

// ── Reading: record → cell ────────────────────────────────────────────────

/** The display string for one record in one column. */
export function readCell<T>(record: T, column: SheetColumn<T>): string {
  if (column.kind === 'derived') return column.get?.(record) ?? ''

  const value = (record as Record<string, unknown>)[column.key]

  if (column.kind === 'langs') {
    return Array.isArray(value) ? value.join(', ') : ''
  }
  return value == null ? '' : String(value)
}

// ── Writing: cell → record ────────────────────────────────────────────────

/**
 * Applies one edited cell onto a record, returning the updated record or a
 * rejection. Never mutates the input.
 *
 * Rejections are surfaced to the user rather than written back over the cell: a
 * programmatic revert would itself enter Univer's undo stack, so Ctrl+Z would
 * re-apply the value that was just refused.
 */
export function applyCellEdit<T>(
  record: T,
  column: SheetColumn<T>,
  raw: unknown
): T | CellRejection {
  if (!isWritable(column)) {
    return { reason: `"${column.header}" is read-only here — edit it on the record page.` }
  }

  const text = raw == null ? '' : String(raw).trim()

  if (column.kind === 'enum') {
    const options = column.options ?? []
    if (text === '') return { reason: `"${column.header}" cannot be empty.` }
    const match = options.find(option => option.toLowerCase() === text.toLowerCase())
    if (!match) {
      return {
        reason: `"${text}" is not a valid ${column.header.toLowerCase()} — use ${options.join(', ')}.`,
      }
    }
    return { ...record, [column.key]: match }
  }

  if (column.kind === 'langs') {
    const codes: LanguageCode[] = []
    for (const part of text.split(',')) {
      const token = part.trim().toUpperCase()
      if (token === '') continue
      const match = LANGUAGE_CODES.find(code => code === token)
      if (!match) {
        return {
          reason: `"${part.trim()}" is not a language code — use ${LANGUAGE_CODES.join(', ')}.`,
        }
      }
      if (!codes.includes(match)) codes.push(match)
    }
    // Run the result through the same normaliser the editors use, so a sheet
    // cannot produce a primary/secondary split the rest of the app rejects.
    const next = { ...record, [column.key]: codes } as T & HasLanguages
    return { ...next, ...normalizeLanguageTags(next) }
  }

  // `text` — an empty cell means null, matching how an editor clears a field.
  return { ...record, [column.key]: text === '' ? null : text }
}

// ── Snapshot construction ─────────────────────────────────────────────────

/** Univer's `IWorkbookData`, built loosely so we do not depend on its internals. */
type WorkbookData = Record<string, unknown>

type Cell = { v: string; s?: string }

/**
 * Builds the workbook snapshot for a set of records.
 *
 * Row 0 is the frozen header and column 0 is the frozen, read-only id. Blank
 * rows are appended below the data so a new record can be typed straight in
 * without an explicit "add row" step.
 */
export function buildWorkbookData<T>(
  records: T[],
  columns: readonly SheetColumn<T>[],
  name: string
): WorkbookData {
  const cellData: Record<number, Record<number, Cell>> = {}

  const headerRow: Record<number, Cell> = {}
  columns.forEach((column, index) => {
    headerRow[index] = { v: column.header, s: 'header' }
  })
  cellData[0] = headerRow

  records.forEach((record, index) => {
    const row: Record<number, Cell> = {}
    columns.forEach((column, columnIndex) => {
      const value = readCell(record, column)
      if (value === '') return
      row[columnIndex] =
        column.kind === 'derived' || column.kind === 'id'
          ? { v: value, s: 'derived' }
          : { v: value }
    })
    cellData[index + HEADER_ROWS] = row
  })

  const columnData: Record<number, { w: number }> = {}
  columns.forEach((column, index) => {
    columnData[index] = { w: column.width }
  })

  const sheetId = 'records'

  return {
    id: `acn-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    sheetOrder: [sheetId],
    defaultStyle: { ff: SHEET_FONT },
    styles: {
      header: { ff: SHEET_FONT, bl: 1, bg: { rgb: '#f7f7f7' } },
      derived: { ff: SHEET_FONT, cl: { rgb: '#999999' } },
    },
    sheets: {
      [sheetId]: {
        id: sheetId,
        name,
        rowCount: records.length + HEADER_ROWS + SPARE_ROWS,
        columnCount: columns.length,
        // Freeze the header row and the id column together.
        freeze: { xSplit: 1, ySplit: 1, startRow: HEADER_ROWS, startColumn: 1 },
        defaultColumnWidth: 140,
        defaultRowHeight: 24,
        cellData,
        columnData,
        rowData: {},
        mergeData: [],
        showGridlines: 1,
        rowHeader: { width: 46 },
        columnHeader: { height: 24 },
        rightToLeft: 0,
      },
    },
  }
}
