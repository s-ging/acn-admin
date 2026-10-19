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
//   · `GET /api/Events/{id}` answers 500, as the real one does — the working
//     single-event read is `GET /api/Events/{id}/full`.
//   · `GET /api/Events/full` is published-only, so the unpublished events exist
//     ONLY on the legacy `GET /api/Events`.
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

// ── The /full projections ───────────────────────────────────────────────────
//
// Derived from the same fixtures as the legacy routes rather than captured
// separately, so the two shapes describe the same events and companies and the
// admin's two-source events loader can be exercised against them.
//
// The quirks reproduced here are the ones that matter to the callers:
//
//   · /api/Events/full is PUBLISHED-ONLY, and /api/Events/{id}/full 404s for an
//     unpublished id as well as an unknown one. That is the whole reason the
//     admin still sweeps the legacy route.
//   · `PageSize` is NOT capped at 100 here, unlike `Size` on /api/Companies.
//   · Organisers come back DEDUPED, where the legacy row repeats one up to 168
//     times.
//   · Dates carry a real +08:00 offset and `endDate` is 23:59:59 of its day.
//   · `url` and `photo` are absolute.
//   · `username`/`password` are absent, as the real wire now has them stripped.

const SITE = 'https://www.acnnewswire.com'

/** A bare host → absolute, matching what the real /full routes return. */
const absolute = value => {
  const raw = (value ?? '').trim().replace(/^\/+/, '')
  if (!raw || !/[a-z0-9]/i.test(raw)) return null
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

const asset = (base, filename) => {
  const raw = (filename ?? '').trim()
  return raw ? `${base}/${raw}` : null
}

/** A legacy date → the same calendar day with the wire's offset. */
const fullDate = (value, endOfDay = false) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((value ?? '').trim())
  if (!match) return null
  return `${match[0]}T${endOfDay ? '23:59:59' : '00:00:00'}+08:00`
}

/** A legacy event row → the reconciled /full shape. */
function toFullEvent(event) {
  const seen = new Set()
  const organisers = []
  for (const row of event.companies ?? []) {
    if (!row || seen.has(row.companyID)) continue
    seen.add(row.companyID)
    const name = (row.companyName ?? '').trim()
    if (!name) continue
    organisers.push({
      id: row.companyID,
      name,
      logo: asset(`${SITE}/images/company`, row.logoFileName),
      url: absolute(row.companyURL),
    })
  }

  return {
    id: event.id,
    name: (event.description ?? '').trim() || null,
    startDate: fullDate(event.startDate),
    endDate: fullDate(event.endDate, true),
    location: (event.location ?? '').trim() || null,
    url: absolute(event.url),
    photo: asset(`${SITE}/eventimages`, event.eventImage),
    isPublished: (event.publish ?? '').trim().toLowerCase() === 'y',
    organiserId: event.compId || null,
    organisers,
  }
}

/** A legacy detail record → the merged /full company. */
function toFullCompany(detail, extra) {
  const name = detail.companyName ?? detail.companyNameEN ?? ''
  return {
    companyId: detail.companyId,
    names: {
      en: name || null,
      ja: detail.companyNameJP || null,
      zhHans: detail.companyNameCH || null,
      zhHant: detail.companyNameCT || null,
      ko: detail.companyNameKO || null,
    },
    url: absolute(detail.url),
    urlJa: absolute(extra?.urlJa),
    logoArticle: asset(`${SITE}/images/company`, detail.logoFilename),
    logoTop: asset(`${SITE}/images/company`, detail.topLogoFilename),
    boilerplate: detail.boilerPlate || null,
    boilerplateExtended: detail.extBoilerPlate || null,
    allowAccess: detail.allowAccess ?? true,
    primarySectorId: detail.sectorId || null,
    profile: {
      established: extra?.established || null,
      // `listedDate` here; the legacy /details route spelled it `listed`.
      listedDate: extra?.listed || null,
      employees: extra?.employees || null,
      dunsNumber: extra?.dunsNumber || null,
      otc: extra?.otc || null,
      marketId: extra?.marketId || null,
      // Named, where the legacy route had positional addr1..addr4.
      addressStreet: extra?.addr1 || null,
      addressDistrict: extra?.addr2 || null,
      addressCity: extra?.addr3 || null,
      addressCountry: extra?.addr4 || null,
      telephone: extra?.telephone || null,
      facsimile: extra?.facsimile || null,
      email: extra?.email || null,
      keyPerson1Name: extra?.pos1Name || null,
      keyPerson1Title: extra?.pos1Desc || null,
      keyPerson2Name: extra?.pos2Name || null,
      keyPerson2Title: extra?.pos2Desc || null,
    },
    socials: {
      blog: detail.blog ?? extra?.blog ?? null,
      facebook: detail.facebook ?? extra?.facebook ?? null,
      twitter: detail.twitter ?? extra?.twitter ?? null,
      // Flat-cased here; both legacy routes used youTube / linkedIn.
      youtube: detail.youTube ?? extra?.youTube ?? null,
      linkedin: detail.linkedIn ?? extra?.linkedIn ?? null,
      telegram: detail.telegram ?? extra?.telegram ?? null,
    },
    annualReport: {
      name: detail.reportFilename ?? null,
      date: detail.reportFileDate ?? null,
      size: detail.reportFileSize ?? null,
    },
    sectors: detail.sectors ?? [],
    tickers: detail.tickers ?? [],
    // Renamed from the legacy `bloomberg`.
    bloombergCodes: detail.bloomberg ?? [],
    rss: detail.rss ?? [],
    // The rich shape, which used to require a separate /api/CompContacts call.
    contacts: (detail.contacts ?? []).map(c => ({
      id: c.contId,
      name: c.contactName ?? null,
      position: c.contactPosition ?? null,
      phone: c.contactPhone ?? null,
      email: c.contactEmail ?? null,
      fax: c.contactFax ?? null,
      description: c.contactDesc ?? null,
      format: c.format ?? 'HTML',
      type: null,
    })),
  }
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

  m = /^\/api\/Companies\/(\d+)\/full$/.exec(path)
  if (m) {
    const id = Number(m[1])
    const captured = fixtures.companyDetails[id]
    const detail = captured
      ? { ...structuredClone(captured), companyId: id }
      : shellCompany(id)
    // The list projection is the only fixture carrying the annual-report and
    // extended-boilerplate fields, which /full folds in — so they come from
    // there rather than being invented.
    const listRow = companyAt(id - 1)
    return send(res, 200, toFullCompany({
      ...detail,
      extBoilerPlate: listRow?.extBoilerPlate ?? null,
      reportFilename: listRow?.reportFilename ?? null,
      reportFileDate: listRow?.reportFileDate ?? null,
      reportFileSize: listRow?.reportFileSize ?? null,
    }, fixtures.companyExtraDetails), origin)
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

  // The reconciled list. Published-only, and PageSize is uncapped.
  if (path === '/api/Events/full') {
    const { pageNumber, requested } = paging(url, ['PageNumber', 'PageSize'])
    const all = Array.from({ length: TOTALS.events }, (_, i) => toFullEvent(eventAt(i)))
      .filter(event => event.isPublished)
    const upcoming = url.searchParams.get('Upcoming')
    const from = url.searchParams.get('From')
    const to = url.searchParams.get('To')
    const today = new Date().toISOString().slice(0, 10)
    const rows = all.filter(event => {
      const day = (event.startDate ?? '').slice(0, 10)
      if (upcoming === 'true' && day < today) return false
      if (from && day < from) return false
      if (to && day > to) return false
      return true
    })
    const start = (pageNumber - 1) * requested
    return send(res, 200, rows.slice(start, start + requested), origin)
  }

  // The detail route that actually works — note the fix landed HERE and not on
  // /api/Events/{id}, which still 500s below. 404s for an unpublished id too,
  // since /full is a published-only projection.
  m = /^\/api\/Events\/(\d+)\/full$/.exec(path)
  if (m) {
    const id = Number(m[1])
    if (id < 1 || id > TOTALS.events) return send(res, 404, { error: 'not found' }, origin)
    const event = toFullEvent(eventAt(id - 1))
    if (!event.isPublished) return send(res, 404, { error: 'not found' }, origin)
    return send(res, 200, event, origin)
  }

  // Broken upstream for every id tried, so it is broken here too. The /full
  // route above is where the working single-event read lives.
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

// ── Writes ──────────────────────────────────────────────────────────────────
//
// Accepted and logged, NOT persisted: a later GET still serves the fixtures.
// Enough to drive the save/delete flows end to end. The real API's create
// response is undeclared in the spec, so a create answers `{ id }` — one of the
// shapes `createdId` in src/lib/api/endpoints.ts accepts.

const WRITE_ROUTES = [
  /^\/api\/Companies$/,
  /^\/api\/Companies\/\d+$/,
  /^\/api\/Companies\/\d+\/industries\/\d+$/,
  /^\/api\/Companies\/\d+\/listings(\/[^/]+\/[^/]+)?$/,
  /^\/api\/Companies\/\d+\/social-links\/[^/]+$/,
  /^\/api\/Events(\/\d+)?$/,
]

let nextCreatedId = 900000

function handleWrite(req, url, origin, res) {
  const path = url.pathname.replace(/\/+$/, '')
  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    if (!WRITE_ROUTES.some(route => route.test(path))) {
      return send(res, 404, { error: `No mock route for ${req.method} ${path}` }, origin)
    }
    const auth = req.headers.authorization ? 'with token' : 'NO TOKEN'
    console.log(`200 ${req.method} ${path} (${auth}) ${body.slice(0, 200)}`)
    const isCreate = req.method === 'POST' && (path === '/api/Companies' || path === '/api/Events')
    return send(res, 200, isCreate ? { id: nextCreatedId++ } : '', origin)
  })
}

// ── Server ──────────────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const origin = req.headers.origin ?? ''

  if (req.method === 'OPTIONS') {
    const headers = { Vary: 'Origin' }
    if (CORS_ORIGIN && origin === CORS_ORIGIN) {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
      headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
    }
    res.writeHead(204, headers)
    return res.end()
  }

  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    return handleWrite(req, url, origin, res)
  }

  if (req.method !== 'GET') {
    return send(res, 405, { error: `${req.method} is not supported.` }, origin)
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
