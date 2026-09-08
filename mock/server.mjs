// mock/server.mjs
// A stand-in for the ACN Newswire API, so the app can be worked on and
// validated while the real one is unreachable — the Azure VM behind it gets
// turned off, and Cloudflare then answers 522 or nothing at all.
//
// Run it with `npm run mock`, or `npm run dev:mock` to start it together with a
// dev server already proxying to it.
//
// It is seeded from ./fixtures.json, which holds REAL responses captured from
// development.acnnewswire.com — trimmed, but not reshaped. Records are then
// cycled with renumbered ids up to the real collection sizes, so paging, the
// total-count search and the caching all meet the volumes they were built for.
//
// The quirks below are reproduced ON PURPOSE. A mock that returns tidy data
// would let exactly the bugs this app had to fix pass unnoticed:
//
//   · `Size` is capped at 100, and a larger value is a 400.
//   · `GET /api/Events/{id}` answers 500, as the real one does.
//   · Absent strings come back as "" or " " as often as null.
//   · An event repeats its organiser once per release it has — up to 168 times.
//   · Event dates have no timezone offset at all.
//   · `companyId` on some rows, `companyID` on others.
//   · Zero CORS headers unless an origin is explicitly allowed, so going
//     straight at it from a browser fails the same way the real one does.
//
// WHAT IT IS NOT: a replica. Records are cycled to reach the real totals, so
// anything derived from a *proportion* is off — 89 of 839 events come back
// unpublished against 23 on the real wire, because the fixture sample happens to
// hold a higher share of them and gets multiplied. Counts, paging boundaries and
// per-record shapes are faithful; ratios are not. Don't chase a number here.
//
// Zero dependencies: node:http and a JSON file.

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = JSON.parse(readFileSync(join(here, 'fixtures.json'), 'utf8'))

const PORT = Number(process.env.MOCK_PORT ?? 4000)

/**
 * The real collection sizes, measured against the live wire.
 *
 * These are what make the mock useful rather than decorative: 9,439 companies
 * is 95 pages, which is the thing the full-sync path exists to handle, and
 * 78,874 articles is what makes the total-count search take a search rather
 * than a lookup.
 */
const TOTALS = {
  companies: Number(process.env.MOCK_COMPANIES ?? 9439),
  articles: Number(process.env.MOCK_ARTICLES ?? 78874),
  events: Number(process.env.MOCK_EVENTS ?? 839),
}

/** The server's own cap. Asking for more is a 400, as upstream. */
const MAX_SIZE = 100

/**
 * Which origins get CORS headers.
 *
 * Empty by default, deliberately — the real API's allowlist is what broke the
 * deployment, and a mock that waves everything through would hide a regression
 * in the proxy setup. Set MOCK_CORS_ORIGIN to opt one in for a direct test.
 */
const CORS_ORIGIN = process.env.MOCK_CORS_ORIGIN ?? ''

// ── Volume ──────────────────────────────────────────────────────────────────

/**
 * The nth record of a collection, built by cycling the fixtures.
 *
 * `renumber` rewrites whichever id fields the shape carries so every synthetic
 * record is distinct — otherwise a 95-page sync would return the same hundred
 * ids ninety-five times and the dedup checks would all pass for the wrong reason.
 */
function nth(list, index, renumber) {
  const base = list[index % list.length]
  return renumber(structuredClone(base), index + 1)
}

const companyAt = i =>
  nth(fixtures.companies, i, (c, n) => {
    c.companyId = n
    // Keep the real name on the record for the first pass through the
    // fixtures, so searching for a company you saw on the live site works.
    if (i >= fixtures.companies.length) c.companyNameEN = `${c.companyNameEN ?? 'Company'} #${n}`
    return c
  })

const articleAt = i =>
  nth(fixtures.articles, i, (a, n) => {
    a.articleId = 100000 + n
    if (i >= fixtures.articles.length) a.headline = `${a.headline ?? 'Release'} (#${n})`
    return a
  })

const eventAt = i =>
  nth(fixtures.events, i, (e, n) => {
    e.id = n
    return e
  })

/** One page of a synthetic collection. */
function page(total, at, pageNumber, size) {
  const start = (pageNumber - 1) * size
  const count = Math.max(0, Math.min(size, total - start))
  return Array.from({ length: count }, (_, i) => at(start + i))
}

// ── Routing ─────────────────────────────────────────────────────────────────

const send = (res, status, body, origin) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', Vary: 'Origin' }
  // Mirrors the real behaviour: the header appears only for an allowed origin,
  // and its absence is what a browser reports as a CORS failure.
  if (CORS_ORIGIN && origin === CORS_ORIGIN) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  res.writeHead(status, headers)
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

/** Reads a paging parameter under either of the two casings the API uses. */
function paging(url, names) {
  const [pageName, sizeName] = names
  const pageNumber = Number(url.searchParams.get(pageName) ?? 1) || 1
  const requested = Number(url.searchParams.get(sizeName) ?? 10) || 10
  return { pageNumber, requested }
}

function handle(url, origin, res) {
  const path = url.pathname.replace(/\/+$/, '') || '/'

  // ── Companies ─────────────────────────────────────────────────────────────
  if (path === '/api/Companies') {
    const { pageNumber, requested } = paging(url, ['Page', 'Size'])
    if (requested > MAX_SIZE) return send(res, 400, { error: 'Size must be <= 100' }, origin)
    return send(res, 200, page(TOTALS.companies, companyAt, pageNumber, requested), origin)
  }

  let m = /^\/api\/Companies\/(\d+)$/.exec(path)
  if (m) {
    const id = Number(m[1])
    // A captured detail record where we have one, so the sub-lists (sectors,
    // tickers, Bloomberg codes, contacts) are real. Otherwise a bare shell,
    // which is what most live companies return anyway.
    const captured = fixtures.companyDetails[id]
    const detail = captured
      ? { ...structuredClone(captured), companyId: id }
      : shellCompany(id)
    return send(res, 200, detail, origin)
  }

  m = /^\/api\/Companies\/(\d+)\/details$/.exec(path)
  if (m) return send(res, 200, fixtures.companyExtraDetails ?? {}, origin)

  if (path === '/api/CompContacts') {
    const companyId = Number(url.searchParams.get('companyId') ?? 0)
    // Only company 3128 had contacts on the live wire; everything else is empty,
    // and the app has to cope with that being the norm.
    const rows = companyId === 3128 ? (fixtures.contacts ?? []) : []
    return send(res, 200, rows, origin)
  }

  // ── Articles ──────────────────────────────────────────────────────────────
  if (path === '/api/Articles') {
    const { pageNumber, requested } = paging(url, ['Page', 'Size'])
    if (requested > MAX_SIZE) return send(res, 400, { error: 'Size must be <= 100' }, origin)
    return send(res, 200, page(TOTALS.articles, articleAt, pageNumber, requested), origin)
  }

  m = /^\/api\/Articles\/press-release\/(\d+)$/.exec(path)
  if (m) {
    const id = Number(m[1])
    const captured = Object.values(fixtures.pressReleases)
    if (captured.length === 0) return send(res, 404, { error: 'not found' }, origin)
    // Cycle the captured bodies so every id resolves to something with real
    // markup — including the CJK, <strong>-wrapped datelines the mapper has to
    // protect.
    const body = structuredClone(captured[id % captured.length])
    body.articleId = id
    return send(res, 200, body, origin)
  }

  // Returned [] on the live host when sampled; kept faithful.
  if (path === '/api/Articles/homepage') return send(res, 200, [], origin)
  // Exact-match only upstream, so it answers [] for anything realistic.
  if (path === '/api/Articles/search') return send(res, 200, [], origin)

  if (path === '/api/Articles/by-industry') {
    const { pageNumber, requested } = paging(url, ['pageNumber', 'pageSize'])
    return send(res, 200, page(200, feedAt, pageNumber, requested), origin)
  }

  m = /^\/api\/Articles\/by-company\/(\d+)$/.exec(path)
  if (m) {
    const { pageNumber, requested } = paging(url, ['pageNumber', 'pageSize'])
    return send(res, 200, page(40, feedAt, pageNumber, requested), origin)
  }

  // ── Events ────────────────────────────────────────────────────────────────
  if (path === '/api/Events') {
    const { pageNumber, requested } = paging(url, ['pageNumber', 'pageSize'])
    return send(res, 200, page(TOTALS.events, eventAt, pageNumber, requested), origin)
  }

  m = /^\/api\/Events\/company\/(\d+)\/year\/(\d+)$/.exec(path)
  if (m) {
    const key = `${m[1]}:${m[2]}`
    const exact = fixtures.eventReleases[key]
    if (exact) return send(res, 200, exact, origin)
    // Synthesised for organiser/year pairs we never captured, derived from the
    // article fixtures so the shape is right (`systemDate`, not `publishDate`).
    const count = Number(m[1]) % 7
    return send(
      res,
      200,
      Array.from({ length: count }, (_, i) => {
        const a = fixtures.articles[(Number(m[1]) + i) % fixtures.articles.length]
        return {
          articleId: a.articleId,
          headline: a.headline,
          summary: a.summary,
          systemDate: `${m[2]}-06-${String((i % 27) + 1).padStart(2, '0')}T14:20:00`,
          companyId: Number(m[1]),
        }
      }),
      origin
    )
  }

  // Broken upstream for every id tried, so it is broken here too — the app
  // reads a single event out of the list because of this.
  if (/^\/api\/Events\/\d+$/.test(path)) {
    return send(res, 500, 'Internal Server Error', origin)
  }

  // A crude stand-in for the swagger page, so hitting the root tells you the
  // mock is alive and what it is.
  if (path === '/' || path === '/swagger/index.html') {
    return send(res, 200, {
      mock: 'ACN Newswire API',
      note: 'Fixtures captured from development.acnnewswire.com. See mock/server.mjs.',
      totals: TOTALS,
      corsAllowedOrigin: CORS_ORIGIN || '(none — same as the real API for an unlisted origin)',
    }, origin)
  }

  return send(res, 404, { error: `No mock route for ${path}` }, origin)
}

/** A company with nothing populated — what most live records look like. */
function shellCompany(id) {
  const base = fixtures.companies[id % fixtures.companies.length]
  return {
    companyId: id,
    companyName: base?.companyNameEN ?? `Company ${id}`,
    companyName2: base?.companyNameEN ?? '',
    companyNameJP: base?.companyNameJP ?? '',
    companyNameCH: base?.companyNameCH ?? '',
    companyNameCT: base?.companyNameCT ?? '',
    companyNameKO: '',
    ticker: '',
    url: base?.url ?? '',
    boilerPlate: base?.boilerPlate ?? '',
    sectorId: 0,
    topLogoFilename: base?.topLogoFilename ?? null,
    logoFilename: base?.logoFilename ?? null,
    username: String(id),
    password: '',
    allowAccess: true,
    blog: null, facebook: null, twitter: null, youTube: null, linkedIn: null, telegram: null,
    rss: [], bloomberg: [], sectors: [], tickers: [], contacts: [],
    page: 1, size: 20, sort1: '', ord1: 'ASC',
  }
}

/** A by-industry / by-company feed row — a different shape from the list row. */
function feedAt(i) {
  const a = fixtures.articles[i % fixtures.articles.length]
  return {
    articleId: 100000 + i + 1,
    headline: a.headline,
    publishDate: a.publishDate,
    summary: a.summary,
    sourceId: i % 2 === 0 ? 2 : 3,
    hasImage: false,
    hasFile: false,
    sectorName: 'Business',
    companies: (a.companies ?? []).map(c => ({
      companyID: c.companyId,
      companyName: c.companyName,
      companyNameCH: '', companyNameCT: '', companyNameJP: '', companyNameKO: '',
      companyURL: '',
      logoFileName: c.logoFilename ?? '',
      topLogoFileName: '',
      sectorName: 'Business',
    })),
    images: [],
  }
}

// ── Server ──────────────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const origin = req.headers.origin ?? ''

  if (req.method === 'OPTIONS') {
    const headers = { Vary: 'Origin' }
    if (CORS_ORIGIN && origin === CORS_ORIGIN) {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    }
    res.writeHead(204, headers)
    return res.end()
  }

  if (req.method !== 'GET') {
    // Every operation in the real spec is a GET; nothing here accepts a write,
    // which is the same wall lib/events/write.ts is benched against.
    return send(res, 405, { error: 'The ACN Newswire API is read-only.' }, origin)
  }

  const started = Date.now()
  try {
    handle(url, origin, res)
  } catch (err) {
    send(res, 500, { error: String(err) }, origin)
  }
  console.log(`${res.statusCode} ${url.pathname}${url.search} (${Date.now() - started}ms)`)
})

server.listen(PORT, () => {
  console.log(`\nMock ACN Newswire API on http://localhost:${PORT}`)
  console.log(`  companies ${TOTALS.companies}  articles ${TOTALS.articles}  events ${TOTALS.events}`)
  console.log(`  CORS: ${CORS_ORIGIN ? `allowing ${CORS_ORIGIN}` : 'no origin allowed (matches the real API)'}`)
  console.log(`\nPoint the dev proxy at it:  WIRE_UPSTREAM=http://localhost:${PORT} npm run dev`)
  console.log(`Or do both at once:         npm run dev:mock\n`)
})
