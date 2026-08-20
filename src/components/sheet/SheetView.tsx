// src/components/sheet/SheetView.tsx
// The spreadsheet surface, shared by every record type that has one.
//
// It exists for the edits a form is bad at: retyping a column across four
// hundred records, pasting a block straight out of Excel, sweeping a fill down a
// range. Univer is used because it is the only grid that implements Excel's
// contiguous-region model — Ctrl+Arrow stopping at the edge of a block rather
// than the edge of the grid — along with fill, paste-special and validation. It
// brings its own chrome and its own type; that is the accepted trade for the
// behaviour, and it is why a sheet lives on its own route.
//
// Everything domain-specific arrives as a `SheetSource`: the columns, and how to
// read, write and create a record. Companies and press releases differ only in
// that object.
//
// Saving is explicit. Edits mark cells dirty and nothing is written until Save
// changes is pressed, so a session of retyping is one batch of writes rather
// than a request per keystroke — which is what the API behind this will need.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUniver, LocaleType, merge } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort'
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter'
import sheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import sheetsSortEnUS from '@univerjs/preset-sheets-sort/locales/en-US'
import sheetsFilterEnUS from '@univerjs/preset-sheets-filter/locales/en-US'
import '@univerjs/preset-sheets-core/lib/index.css'
import '@univerjs/preset-sheets-sort/lib/index.css'
import '@univerjs/preset-sheets-filter/lib/index.css'

import { Button } from '../ui/Button'
import { Topbar } from '../ui/Topbar'
import { SHEET_FONT, buildWorkbookData } from '../../lib/sheet/snapshot'
import { commitCells } from '../../lib/sheet/commit'
import { HEADER_ROWS, ID_COLUMN } from '../../lib/sheet/schema'
import type { SheetSource } from '../../lib/sheet/schema'
import type { CellRejectionAt, DirtyCell } from '../../lib/sheet/commit'

/**
 * Every sort command Univer registers — plain, extended, context-menu and custom
 * — shares this prefix. A sort moves existing values between rows without
 * changing any record's data, so the cell changes it emits must not be treated
 * as edits: doing so marks the whole sorted block dirty and queues a no-op
 * rewrite of every record, which against a real API is hundreds of pointless
 * row updates.
 */
const SORT_COMMAND_PREFIX = 'sheet.command.sort-range'

/** Minimal shape we need back from the engine, so this file owns no Univer types. */
interface GridHandle {
  getValue: (row: number, column: number) => unknown
  setValue: (row: number, column: number, value: number) => void
}

interface SheetViewProps<T> {
  source: SheetSource<T>
}

export function SheetView<T>({ source }: SheetViewProps<T>) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<GridHandle | null>(null)

  // Dirty cells are held in a ref keyed by coordinate: the grid is the source of
  // truth for values, so all we track is *which* cells to re-read on save. A
  // cell edited five times is still one entry.
  const dirtyRef = useRef(new Map<string, DirtyCell>())
  const [dirtyCount, setDirtyCount] = useState(0)

  const [booted, setBooted] = useState(false)
  const [rowCount, setRowCount] = useState(0)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [rejections, setRejections] = useState<CellRejectionAt[]>([])

  const save = useCallback(() => {
    const grid = gridRef.current
    if (!grid || dirtyRef.current.size === 0) return

    const result = commitCells(
      dirtyRef.current.values(),
      (row, column) => grid.getValue(row, column),
      source
    )

    // Write real ids into rows that just created a record. These land in the id
    // column, which `commitCells` drops, so they cannot loop back as user edits.
    for (const { row, id } of result.created) grid.setValue(row, ID_COLUMN, id)

    dirtyRef.current.clear()
    setDirtyCount(0)
    setRejections(result.rejections)
    setSavedNote(
      result.saved.length > 0
        ? `Saved ${result.saved.length} ${result.saved.length === 1 ? 'record' : 'records'} at ${new Date().toLocaleTimeString()}`
        : null
    )
  }, [source])

  // Leaving with unsaved edits should not be silent.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current.size > 0) event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // The engine is booted from a timer rather than inline, for two reasons that
    // are really one. Univer owns a React root and tears it down synchronously,
    // which React warns about if that happens inside an effect cleanup; and under
    // StrictMode's mount/unmount/remount an instance disposed on a later tick
    // would outlive the remount and strip the canvas the second instance just
    // drew. Scheduling both boot and dispose keeps them in FIFO order, and lets
    // StrictMode's immediate cleanup cancel the first boot before it ever runs.
    let disposed = false
    let teardown: (() => void) | undefined

    const boot = setTimeout(() => {
      if (disposed) return
      teardown = start(container)
    }, 0)

    return () => {
      disposed = true
      clearTimeout(boot)
      teardown?.()
    }

    function start(host: HTMLDivElement): () => void {
      const records = source.load()

      const { univer, univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: merge({}, sheetsCoreEnUS, sheetsSortEnUS, sheetsFilterEnUS),
        },
        presets: [
          UniverSheetsCorePreset({
            container: host,
            // The workbook is a view onto one table, so the sheet tab bar and
            // the statistics footer have nothing to say. The formula bar stays.
            footer: false,
            // Puts Inter at the top of the font picker so the toolbar shows the
            // font cells are actually in. The cell default itself is set on the
            // workbook — see SHEET_FONT in lib/sheet/snapshot.ts. Appended
            // rather than `override`, so Univer's own list stays available.
            customFontFamily: [{ value: SHEET_FONT, label: SHEET_FONT }],
            // Hide the ribbon and context-menu sort entries. They sort the
            // contiguous block without knowing row 0 is a header, so "Expand
            // Ascending" drops the column titles into the middle of the data.
            // The sort preset still has to be registered — it is what puts the
            // Ascending/Descending buttons inside the header filter dropdown,
            // which is the header-aware path and the one we want people using.
            menu: {
              'sheet.menu.sheets-sort': { hidden: true },
              'sheet.menu.sheets-sort-ctx': { hidden: true },
            },
          }),
          // Sorting and filtering both reach the user through the dropdown on
          // each header cell. Safe because a row's identity travels with it: the
          // record id lives in column 0 and is read back out of whichever row a
          // cell ends up in — see lib/sheet/commit.ts.
          UniverSheetsSortPreset(),
          UniverSheetsFilterPreset(),
        ],
      })

      univerAPI.createWorkbook(buildWorkbookData(records, source.columns, source.title))

      // Turn the header row plus the data into a filter range.
      //
      // This is what teaches Univer that row 0 is a header. Without it, "Expand
      // Ascending" treats the whole contiguous block as data and sorts the
      // header down into the middle of the records — the column titles end up as
      // row values, and the sort is unusable. Inside a filter range, sorting from
      // a header dropdown reorders the data rows only and carries every column
      // with them, which is exactly what row identity needs: the id in column 0
      // travels with its record.
      const sheet = univerAPI.getActiveWorkbook()?.getActiveSheet()
      if (sheet && records.length > 0) {
        const range = sheet.getRange(0, 0, records.length + HEADER_ROWS, source.columns.length)
        if (!range.getFilter()) range.createFilter()
      }

      gridRef.current = {
        getValue: (row, column) =>
          univerAPI.getActiveWorkbook()?.getActiveSheet()?.getRange(row, column).getValue(),
        setValue: (row, column, value) => {
          univerAPI.getActiveWorkbook()?.getActiveSheet()?.getRange(row, column).setValue(value)
        },
      }

      setRowCount(records.length)
      setBooted(true)

      // Raised while a sort is running, so the value changes it emits are not
      // mistaken for user edits. A counter rather than a boolean because a sort
      // can nest other commands inside itself.
      let sorting = 0
      const beforeSort = univerAPI.addEvent(univerAPI.Event.BeforeCommandExecute, ({ id }) => {
        if (id.startsWith(SORT_COMMAND_PREFIX)) sorting += 1
      })
      const afterSort = univerAPI.addEvent(univerAPI.Event.CommandExecuted, ({ id }) => {
        if (id.startsWith(SORT_COMMAND_PREFIX)) sorting = Math.max(0, sorting - 1)
      })

      const disposable = univerAPI.addEvent(
        univerAPI.Event.SheetValueChanged,
        ({ effectedRanges }) => {
          if (sorting > 0) return
          let added = false
          for (const effected of effectedRanges) {
            const { startRow, endRow, startColumn, endColumn } = effected.getRange()
            for (let row = Math.max(startRow, HEADER_ROWS); row <= endRow; row++) {
              for (let column = startColumn; column <= endColumn; column++) {
                const definition = source.columns[column]
                // Past the end of the schema there is no field to write to, and
                // the id column is ours, not the user's.
                if (!definition || definition.kind === 'id') continue
                const key = `${row}:${column}`
                if (dirtyRef.current.has(key)) continue
                dirtyRef.current.set(key, { row, column })
                added = true
              }
            }
          }
          if (added) setDirtyCount(dirtyRef.current.size)
        }
      )

      return () => {
        disposable.dispose()
        beforeSort.dispose()
        afterSort.dispose()
        gridRef.current = null
        setTimeout(() => univer.dispose(), 0)
      }
    }
  }, [source])

  /** Navigates away, checking first that nothing unsaved is being thrown out. */
  const leave = (to: string) => {
    if (
      dirtyRef.current.size > 0 &&
      !window.confirm(`Discard ${dirtyRef.current.size} unsaved cell changes?`)
    ) {
      return
    }
    navigate(to)
  }

  // Matches the breadcrumb the record editors use: clickable secondary parents,
  // primary weight-500 leaf. `Home` points at /companies everywhere in the app.
  const crumb = { cursor: 'pointer', color: 'var(--color-text-secondary)' } as const

  return (
    <div className="sheet-page">
      <Topbar
        breadcrumb={
          <>
            <span style={crumb} onClick={() => leave('/companies')}>
              Home
            </span>
            {' › '}
            <span style={crumb} onClick={() => leave(source.listRoute)}>
              {source.title}
            </span>
            {' › '}
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
              Spreadsheet
            </span>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => leave(source.listRoute)}>
              Table view
            </Button>
            <Button
              variant={dirtyCount > 0 ? 'primary' : 'outline'}
              size="sm"
              onClick={save}
              disabled={dirtyCount === 0}
            >
              {dirtyCount > 0 ? `Save changes (${dirtyCount})` : 'Save changes'}
            </Button>
          </>
        }
      />

      <div className="sheet-statusbar">
        <span className="hint">
          {!booted
            ? 'Starting spreadsheet…'
            : dirtyCount > 0
              ? `${dirtyCount} unsaved ${dirtyCount === 1 ? 'cell' : 'cells'}`
              : (savedNote ?? `${rowCount} ${rowCount === 1 ? 'record' : 'records'}`)}
        </span>
      </div>

      {rejections.length > 0 && (
        <div className="sheet-rejections">
          <div className="label">
            {rejections.length} {rejections.length === 1 ? 'cell was' : 'cells were'} not saved
          </div>
          <ul>
            {rejections.slice(0, 8).map((rejection, index) => (
              <li key={`${rejection.row}-${rejection.column}-${index}`}>
                {/* Univer numbers rows from 1, so the label matches the row
                    header the user is looking at. */}
                <span className="label monospace">
                  Row {rejection.row + 1} · {rejection.header}
                </span>
                {' — '}
                {rejection.reason}
              </li>
            ))}
            {rejections.length > 8 && (
              <li className="hint">…and {rejections.length - 8} more.</li>
            )}
          </ul>
          <button className="label clickable" onClick={() => setRejections([])}>
            Dismiss
          </button>
        </div>
      )}

      {/* Univer measures its own canvas against this element, so it needs a
          settled height before the engine mounts — hence the flex column above
          rather than letting the grid size itself. */}
      <div className="sheet-canvas" ref={containerRef} />
    </div>
  )
}
