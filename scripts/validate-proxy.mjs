// scripts/validate-proxy.mjs
// Is the /wire proxy set up correctly, and can it reach the API?
//
//   npm run validate                                   # a local dev server
//   npm run validate -- --url https://your.vercel.app  # a deployment
//
// The point of this script is that those two questions have DIFFERENT answers
// and the browser console conflates them. A blocked CORS request and an API
// that is simply down both surface as "No 'Access-Control-Allow-Origin' header
// is present", because a Cloudflare 5xx error page carries no CORS headers
// either. So the same message can mean "your proxy is misconfigured" or "the
// Azure VM is off", and guessing wrong costs an afternoon.
//
// This separates them by looking at WHAT comes back rather than whether it
// worked:
//
//   JSON array          → proxy good, API up.               Everything works.
//   HTML                → proxy NOT applied. The SPA catch-all swallowed the
//                         request, which means the rewrite is missing or is
//                         ordered after `/(.*)`.
//   502 / 504 / 522     → proxy good, API down. The request was forwarded and
//                         the upstream failed to answer — with the VM off, this
//                         is the expected PASS for the proxy.
//   nothing at all      → the origin itself is unreachable.
//
// So the proxy can be validated with the API off, which is the situation this
// was written in.

const args = process.argv.slice(2)
const flag = name => {
  const i = args.indexOf(name)
  return i === -1 ? null : args[i + 1]
}

const origin = (flag('--url') ?? 'http://localhost:5173').replace(/\/+$/, '')
const UPSTREAM = 'https://development.acnnewswire.com'
const TIMEOUT = Number(flag('--timeout') ?? 20000)

const results = []
const record = (ok, name, detail) => {
  results.push({ ok, name, detail })
  const mark = ok === true ? '  PASS' : ok === false ? '  FAIL' : '  WARN'
  console.log(`${mark}  ${name}`)
  if (detail) console.log(`        ${detail}`)
}

async function get(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const text = await response.text()
    return { status: response.status, headers: response.headers, text }
  } catch (err) {
    return { status: 0, headers: new Headers(), text: '', error: err }
  } finally {
    clearTimeout(timer)
  }
}

/** What a body actually is, regardless of what the status claims. */
function classify(text) {
  const trimmed = text.trim()
  if (!trimmed) return 'empty'
  if (trimmed.startsWith('<')) return 'html'
  try {
    return Array.isArray(JSON.parse(trimmed)) ? 'json-array' : 'json'
  } catch {
    return 'text'
  }
}

console.log(`\nValidating ${origin}\n`)

// ── 1. Does the origin serve the app at all? ─────────────────────────────────
const app = await get(`${origin}/`)
if (app.status === 0) {
  record(false, 'The origin responds', `${origin} is unreachable — ${app.error?.message ?? 'no response'}`)
  console.log('\nNothing else can be checked. Is the dev server running, or the URL right?\n')
  process.exit(1)
}
record(
  app.status === 200 && classify(app.text) === 'html',
  'The origin serves the app',
  `${app.status}, body looks like ${classify(app.text)}`
)

// ── 2. Is the /wire rewrite in place, and what does it reach? ────────────────
const wire = await get(`${origin}/wire/api/Companies?Page=1&Size=1`)
const kind = classify(wire.text)

if (kind === 'html') {
  record(
    false,
    'The /wire proxy is configured',
    'Got HTML back — the SPA catch-all answered instead of the proxy. In vercel.json, ' +
      'the /wire rewrite must come BEFORE the "/(.*)" → /index.html entry; rewrites match in order.'
  )
} else if (kind === 'json-array') {
  record(true, 'The /wire proxy is configured', `${wire.status}, JSON array — forwarded and answered`)
} else if (wire.status >= 500 || wire.status === 0) {
  record(
    true,
    'The /wire proxy is configured',
    `${wire.status || 'no response'} — the request WAS forwarded; the upstream is what failed. ` +
      'With the Azure VM off this is the expected result.'
  )
} else {
  record(null, 'The /wire proxy is configured', `${wire.status}, body looks like ${kind}`)
}

// ── 3. Is it really the API on the other end? ───────────────────────────────
if (kind === 'json-array') {
  const rows = JSON.parse(wire.text)
  const shaped = rows.length === 0 || typeof rows[0]?.companyId === 'number'
  record(shaped, 'The response is company-shaped', `${rows.length} row(s), first key set: ${Object.keys(rows[0] ?? {}).slice(0, 4).join(', ') || '(empty page)'}`)

  // The server caps Size at 100 and 400s above it. A proxy pointed at the wrong
  // thing will not reproduce that.
  const capped = await get(`${origin}/wire/api/Companies?Page=1&Size=500`)
  record(
    capped.status === 400,
    'The upstream enforces its Size<=100 cap',
    `Size=500 → ${capped.status}${capped.status === 400 ? '' : ' (expected 400)'}`
  )

  // Deep paging is what the full-sync path depends on.
  const deep = await get(`${origin}/wire/api/Companies?Page=90&Size=100`)
  const deepRows = classify(deep.text) === 'json-array' ? JSON.parse(deep.text).length : -1
  record(deepRows > 0, 'Deep pages are reachable', `Page 90 → ${deepRows} rows`)

  // Events are the other collection the app syncs in full.
  const events = await get(`${origin}/wire/api/Events?pageNumber=1&pageSize=2`)
  record(
    classify(events.text) === 'json-array',
    'Events respond',
    `${events.status}, ${classify(events.text)}`
  )

  // Broken upstream, on purpose. If this ever answers 200 the app can stop
  // reading single events out of the cached list.
  const one = await get(`${origin}/wire/api/Events/163`)
  record(
    one.status === 500 ? null : true,
    'GET /api/Events/{id}',
    one.status === 500
      ? '500, still broken upstream — the app reads single events from the list instead'
      : `${one.status} — it may have been FIXED. Worth revisiting loadEventRecord().`
  )
}

// ── 4. No CORS header needed, and none expected ─────────────────────────────
//
// Only meaningful once the proxy is actually answering. When the catch-all
// serves index.html instead, any header on that response belongs to the static
// host — Vercel sends `access-control-allow-origin: *` on its assets — and
// reporting that as a CORS finding buries the one failure that matters under a
// second, unrelated-looking one.
const acao = wire.headers.get('access-control-allow-origin')
if (kind === 'html') {
  record(null, 'No CORS header is relied on', 'Not checked — the proxy is not answering yet (see above)')
} else {
  record(
    !acao,
    'No CORS header is relied on',
    acao
      ? `Upstream sent one (${acao}) — harmless, but the proxy means it is not needed`
      : 'None present, and none needed — the request was same-origin'
  )
}

// ── 5. Report on the upstream directly, for context ─────────────────────────
const direct = await get(`${UPSTREAM}/api/Companies?Page=1&Size=1`)
const directKind = classify(direct.text)
console.log(
  `\n  note   The API directly: ${direct.status || 'no response'}` +
    (direct.status === 200 && directKind === 'json-array'
      ? ' — up.'
      : direct.status === 0
        ? ' — unreachable (Azure VM off, most likely).'
        : direct.status >= 500
          ? ' — Cloudflare cannot reach the origin (Azure VM off, most likely).'
          : ` — ${directKind}.`)
)
console.log(
  '         A direct browser call would be blocked regardless: the API allowlists\n' +
    '         specific origins, which is why the app proxies. This is only context.'
)

// ── Verdict ─────────────────────────────────────────────────────────────────
const failed = results.filter(r => r.ok === false)
console.log(
  `\n${failed.length === 0 ? 'OK' : 'PROBLEMS'} — ${results.filter(r => r.ok === true).length} passed, ` +
    `${failed.length} failed, ${results.filter(r => r.ok === null).length} to note\n`
)
if (kind === 'html') {
  console.log(
    [
      'Next: this origin serves the app but has no /wire proxy. The likeliest',
      'reason is simply that it has not been redeployed since vercel.json',
      'changed — the rewrite ships with the deployment, so a redeploy turns',
      'it on.',
      '',
    ].join('\n')
  )
}

process.exit(failed.length === 0 ? 0 : 1)
