/**
 * Unlike the other suites in this repo, these tests touch the storage layer, so
 * they need a real `localStorage`. Scoped here rather than set globally so the
 * pure-function suites keep running in the faster node environment.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { commitCells } from './commit'
import { HEADER_ROWS, ID_COLUMN } from './schema'
import { companySheetSource } from '../companies/sheet'
import { pressReleaseSheetSource } from '../press-releases/sheet'
import { blankCompany } from '../companies/blank'
import { loadCompany, saveCompany } from '../companies/storage'
import { createArticle } from '../press-releases/normalize'
import { loadArticle, saveArticle } from '../press-releases/storage'
import type { DirtyCell } from './commit'
import type { SheetSource } from './schema'

const FIRST_ROW = HEADER_ROWS

const columnOf = <T,>(source: SheetSource<T>, key: string) => {
  const index = source.columns.findIndex(c => c.key === key)
  if (index === -1) throw new Error(`no sheet column for "${key}"`)
  return index
}

const co = (key: string) => columnOf(companySheetSource, key)
const pr = (key: string) => columnOf(pressReleaseSheetSource, key)

/** A grid backed by a plain map, standing in for the Univer sheet. */
const grid = (cells: Record<string, unknown>) =>
  (row: number, column: number) => cells[`${row}:${column}`] ?? null

const at = (row: number, column: number): DirtyCell => ({ row, column })

beforeEach(() => {
  localStorage.clear()
})

describe('commitCells — companies', () => {
  const NAME = co('name_en')
  const STATUS = co('status')
  const CITY = co('address_city')
  const LANGS = co('languages')
  const SECTORS = co('sectors') // derived — read-only

  it('writes an edited cell onto the company named by the row id', () => {
    saveCompany({ ...blankCompany(1001, 'Toyota'), address_city: 'Nagoya' })

    const result = commitCells(
      [at(FIRST_ROW, CITY)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 1001, [`${FIRST_ROW}:${CITY}`]: 'Toyota City' }),
      companySheetSource
    )

    expect(result.rejections).toEqual([])
    expect(result.saved).toHaveLength(1)
    expect(loadCompany(1001)?.address_city).toBe('Toyota City')
  })

  it('identifies the row by its id cell, not its position', () => {
    // The same edit on row 5 must still reach company 1002 when that is the id
    // sitting in row 5 — this is what makes sorting inside the sheet safe.
    saveCompany(blankCompany(1001, 'Toyota'))
    saveCompany(blankCompany(1002, 'Honda'))

    commitCells(
      [at(FIRST_ROW + 4, CITY)],
      grid({ [`${FIRST_ROW + 4}:${ID_COLUMN}`]: 1002, [`${FIRST_ROW + 4}:${CITY}`]: 'Hamamatsu' }),
      companySheetSource
    )

    expect(loadCompany(1002)?.address_city).toBe('Hamamatsu')
    expect(loadCompany(1001)?.address_city).toBeNull()
  })

  it('groups a multi-column paste into one write per row', () => {
    saveCompany(blankCompany(1001, 'Toyota'))

    const result = commitCells(
      [at(FIRST_ROW, NAME), at(FIRST_ROW, CITY), at(FIRST_ROW, STATUS)],
      grid({
        [`${FIRST_ROW}:${ID_COLUMN}`]: 1001,
        [`${FIRST_ROW}:${NAME}`]: 'Toyota Motor',
        [`${FIRST_ROW}:${CITY}`]: 'Toyota City',
        [`${FIRST_ROW}:${STATUS}`]: 'active',
      }),
      companySheetSource
    )

    expect(result.saved).toHaveLength(1)
    const saved = loadCompany(1001)
    expect(saved?.name_en).toBe('Toyota Motor')
    expect(saved?.address_city).toBe('Toyota City')
    expect(saved?.status).toBe('active')
  })

  it('empties a field when its cell is cleared', () => {
    saveCompany({ ...blankCompany(1001, 'Toyota'), address_city: 'Nagoya' })

    commitCells(
      [at(FIRST_ROW, CITY)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 1001 }),
      companySheetSource
    )

    expect(loadCompany(1001)?.address_city).toBeNull()
  })

  it('reads the value at save time, so a cell edited twice writes once', () => {
    saveCompany(blankCompany(1001, 'Toyota'))

    // The dirty set holds a coordinate, not a value — whatever the grid says
    // when Save is pressed is what lands.
    const result = commitCells(
      [at(FIRST_ROW, CITY), at(FIRST_ROW, CITY)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 1001, [`${FIRST_ROW}:${CITY}`]: 'Final' }),
      companySheetSource
    )

    expect(result.saved).toHaveLength(1)
    expect(loadCompany(1001)?.address_city).toBe('Final')
  })

  it('rejects a value outside an enum without discarding the rest of the row', () => {
    saveCompany(blankCompany(1001, 'Toyota'))

    const result = commitCells(
      [at(FIRST_ROW, STATUS), at(FIRST_ROW, CITY)],
      grid({
        [`${FIRST_ROW}:${ID_COLUMN}`]: 1001,
        [`${FIRST_ROW}:${STATUS}`]: 'retired',
        [`${FIRST_ROW}:${CITY}`]: 'Toyota City',
      }),
      companySheetSource
    )

    expect(result.rejections).toHaveLength(1)
    expect(result.rejections[0].header).toBe('Status')
    expect(loadCompany(1001)?.address_city).toBe('Toyota City')
    expect(loadCompany(1001)?.status).toBe('draft')
  })

  it('rejects an edit to a derived column instead of silently dropping it', () => {
    saveCompany(blankCompany(1001, 'Toyota'))

    const result = commitCells(
      [at(FIRST_ROW, SECTORS)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 1001, [`${FIRST_ROW}:${SECTORS}`]: 'Automotive' }),
      companySheetSource
    )

    expect(result.rejections).toHaveLength(1)
    expect(result.rejections[0].reason).toMatch(/read-only/i)
    expect(result.saved).toEqual([])
  })

  it('parses a language list and keeps the primary/secondary split legal', () => {
    saveCompany(blankCompany(1001, 'Toyota'))

    commitCells(
      [at(FIRST_ROW, LANGS)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 1001, [`${FIRST_ROW}:${LANGS}`]: 'ja, en' }),
      companySheetSource
    )

    // `languages` holds at most the main language; the normaliser trims the rest.
    expect(loadCompany(1001)?.languages).toEqual(['JA'])
  })

  it('rejects an unknown language code', () => {
    saveCompany(blankCompany(1001, 'Toyota'))

    const result = commitCells(
      [at(FIRST_ROW, LANGS)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 1001, [`${FIRST_ROW}:${LANGS}`]: 'EN, KLINGON' }),
      companySheetSource
    )

    expect(result.rejections).toHaveLength(1)
    expect(result.rejections[0].reason).toMatch(/language code/i)
  })

  it('creates a company when content is typed into a row with no id', () => {
    saveCompany(blankCompany(1001, 'Toyota'))

    const result = commitCells(
      [at(FIRST_ROW + 1, NAME)],
      grid({ [`${FIRST_ROW + 1}:${NAME}`]: 'Nissan' }), // no id cell on that row
      companySheetSource
    )

    expect(result.created).toHaveLength(1)
    const { row, id } = result.created[0]
    expect(row).toBe(FIRST_ROW + 1)
    expect(id).toBe(1002) // next after the existing 1001
    expect(loadCompany(id)?.name_en).toBe('Nissan')
  })

  it('names a created record even when the name cell is empty', () => {
    const result = commitCells(
      [at(FIRST_ROW, CITY)],
      grid({ [`${FIRST_ROW}:${CITY}`]: 'Osaka' }),
      companySheetSource
    )

    const id = result.created[0].id
    expect(loadCompany(id)?.name_en).toBe('New Company')
    expect(loadCompany(id)?.address_city).toBe('Osaka')
  })

  it('ignores a blank row that was only tidied, creating nothing', () => {
    const result = commitCells([at(FIRST_ROW + 3, CITY)], grid({}), companySheetSource)

    expect(result.created).toEqual([])
    expect(result.saved).toEqual([])
  })

  it('reports a row whose id no longer resolves', () => {
    const result = commitCells(
      [at(FIRST_ROW, CITY)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 4242, [`${FIRST_ROW}:${CITY}`]: 'Osaka' }),
      companySheetSource
    )

    expect(result.saved).toEqual([])
    expect(result.rejections[0].reason).toMatch(/No record with id 4242/)
  })

  it('never writes through the header row', () => {
    saveCompany(blankCompany(1001, 'Toyota'))

    const result = commitCells(
      [at(0, NAME)],
      grid({ '0:0': 'ID', [`0:${NAME}`]: 'Name (EN)' }),
      companySheetSource
    )

    expect(result.saved).toEqual([])
    expect(loadCompany(1001)?.name_en).toBe('Toyota')
  })

  it('drops writes to the id column so id write-backs cannot loop', () => {
    saveCompany(blankCompany(1001, 'Toyota'))

    const result = commitCells(
      [at(FIRST_ROW, ID_COLUMN)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 1001 }),
      companySheetSource
    )

    expect(result.saved).toEqual([])
    expect(result.rejections).toEqual([])
    expect(loadCompany(1001)).not.toBeNull()
  })

  it('bumps updated_at on every saved company', () => {
    const old = '2020-01-01T00:00:00.000Z'
    saveCompany({ ...blankCompany(1001, 'Toyota'), updated_at: old })

    commitCells(
      [at(FIRST_ROW, CITY)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 1001, [`${FIRST_ROW}:${CITY}`]: 'Osaka' }),
      companySheetSource
    )

    expect(loadCompany(1001)?.updated_at).not.toBe(old)
  })
})

describe('commitCells — press releases', () => {
  const HEADLINE = pr('headline')
  const STATUS = pr('status')
  const TOPIC = pr('topic')
  const LOCATION = pr('location')
  const SECTOR = pr('sector_type') // derived — owned by the classification rules
  const BODY = pr('body') // derived — the dateline lives inside body_html

  it('writes an edited cell onto the release named by the row id', () => {
    saveArticle(createArticle(2001))

    const result = commitCells(
      [at(FIRST_ROW, HEADLINE)],
      grid({
        [`${FIRST_ROW}:${ID_COLUMN}`]: 2001,
        [`${FIRST_ROW}:${HEADLINE}`]: 'Toyota reports record quarter',
      }),
      pressReleaseSheetSource
    )

    expect(result.rejections).toEqual([])
    expect(loadArticle(2001)?.headline).toBe('Toyota reports record quarter')
  })

  it('accepts a status from the release picklist and rejects one outside it', () => {
    saveArticle(createArticle(2001))

    const ok = commitCells(
      [at(FIRST_ROW, STATUS)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 2001, [`${FIRST_ROW}:${STATUS}`]: 'published' }),
      pressReleaseSheetSource
    )
    expect(ok.rejections).toEqual([])
    expect(loadArticle(2001)?.status).toBe('published')

    const bad = commitCells(
      [at(FIRST_ROW, STATUS)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 2001, [`${FIRST_ROW}:${STATUS}`]: 'spiked' }),
      pressReleaseSheetSource
    )
    expect(bad.rejections).toHaveLength(1)
    expect(loadArticle(2001)?.status).toBe('published')
  })

  it('refuses the derived sector, which the classification rules own', () => {
    saveArticle(createArticle(2001))

    const result = commitCells(
      [at(FIRST_ROW, SECTOR)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 2001, [`${FIRST_ROW}:${SECTOR}`]: 'Technology' }),
      pressReleaseSheetSource
    )

    expect(result.rejections).toHaveLength(1)
    expect(loadArticle(2001)?.sector_type).toBeNull()
  })

  it('refuses the body, which carries the dateline', () => {
    saveArticle({ ...createArticle(2001), body_html: '<p>TOKYO, Aug 20, 2026 - text</p>' })

    const result = commitCells(
      [at(FIRST_ROW, BODY)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 2001, [`${FIRST_ROW}:${BODY}`]: 'rewritten' }),
      pressReleaseSheetSource
    )

    expect(result.rejections).toHaveLength(1)
    expect(loadArticle(2001)?.body_html).toBe('<p>TOKYO, Aug 20, 2026 - text</p>')
  })

  it('creates a release when content is typed into a row with no id', () => {
    saveArticle(createArticle(2001))

    const result = commitCells(
      [at(FIRST_ROW + 1, HEADLINE)],
      grid({ [`${FIRST_ROW + 1}:${HEADLINE}`]: 'Honda opens plant' }),
      pressReleaseSheetSource
    )

    expect(result.created).toHaveLength(1)
    const created = loadArticle(result.created[0].id)
    expect(created?.headline).toBe('Honda opens plant')
    // A new release still gets its ACN-prefixed article id.
    expect(created?.article_id).toBe(`ACN-${result.created[0].id}`)
  })

  it('titles a created release even when the headline cell is empty', () => {
    const result = commitCells(
      [at(FIRST_ROW, LOCATION)],
      grid({ [`${FIRST_ROW}:${LOCATION}`]: 'Tokyo' }),
      pressReleaseSheetSource
    )

    expect(loadArticle(result.created[0].id)?.headline).toBe('Untitled release')
  })

  it('accepts a topic from the picklist', () => {
    saveArticle(createArticle(2001))

    const result = commitCells(
      [at(FIRST_ROW, TOPIC)],
      grid({ [`${FIRST_ROW}:${ID_COLUMN}`]: 2001, [`${FIRST_ROW}:${TOPIC}`]: 'Earnings' }),
      pressReleaseSheetSource
    )

    expect(result.rejections).toEqual([])
    expect(loadArticle(2001)?.topic).toBe('Earnings')
  })
})
