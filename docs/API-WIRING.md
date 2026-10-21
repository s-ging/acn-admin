# Wiring to the ACN Newswire API

Spec: <https://development.acnnewswire.com/swagger/index.html>
Base URL: `VITE_API_BASE_URL`, defaulting to `https://development.acnnewswire.com`.

This is the record of what the API can and cannot supply, so nobody has to
re-derive it by probing the wire again. The code carries the same notes at the
point they matter; this is the overview.

## How much is there

The API returns bare arrays — no envelope, no total-count header, no `Link`
header. The only way to learn how much exists is to page until a page comes back
short. Measured against the dev host:

| | Records | Wire size | Fetch time |
| --- | --- | --- | --- |
| Companies | **9,606** | 4.3 MB | ~2 s at concurrency 8 |
| Articles | **80,602** | ~70 MB | minutes |
| Events (legacy `/api/Events`) | **839** | 2.65 MB | ~1 s, nine pages |
| Events (`/api/Events/full`) | **816** published | 286 KB | one request |

Counts re-measured 2026-09-23. **The events archive is back.** It had collapsed
to 7 rows on 2026-09-10 with `compId: null` on every one; all 839 are served
again, and `compId` is populated on the 108 events that have an organiser.

Note the two event rows. The API team shipped the `../../contracts/`
reconciliation as **new `/full` paths beside the old ones**, not as changes to
them — so both shapes are live, and the legacy path keeps all its quirks,
including repeating an event's organiser once per release it has. The same 816
events cost 2.65 MB there and 286 KB on `/full`.

That difference is why the two are handled differently:

- **Companies are fetched in full.** `loadAllCompanies` pages through all 95
  pages, so the list — and its search and sort — work over the whole set.
- **Articles are paged**, and the list pages with them. Its search, column
  filters and A–Z index therefore apply to the page in hand, which the toolbar
  says out loud. Fetching 78,874 releases to show 50 would be absurd, and
  holding them would cost ~140 MB as `PressRelease` records.
- **Companies paginate the display, not the fetch.** The whole set is cached, so
  its search, column filters and A–Z index cover all 9,439 — and paging costs no
  requests at all.
- **Events are fetched in full**, like companies, and from **two sources**.
  `/api/Events/full` is published-only — 816 rows, missing the 23 the wire marks
  unpublished — and this is an admin panel, where those 23 are exactly the
  records someone would come here to publish. So `/full` supplies the 816 it
  knows and is authoritative wherever the two overlap, and the legacy sweep
  contributes only the rows `/full` does not have. Either source may fail alone
  without taking the list down. See `loadAllEvents`.

## Caching, and what is stored where

Loading is **cache-first**, which is what keeps the API quiet and what makes the
app work offline. Two stores, two jobs, and the difference matters:

| | `lib/api/cache.ts` (IndexedDB) | `lib/*/storage.ts` (localStorage) |
| --- | --- | --- |
| Holds | what the wire said | edits, and records created here |
| Disposable? | Yes — drop it any time, costs a re-fetch | **No.** The only copy of anything not yet synced, and of every article edit |
| Capacity | hundreds of MB | ~5 MB |

The full company set is ~16.7 MB as `CompanyFull` (1,856 bytes each, measured),
which is why it lives in IndexedDB — a localStorage write of that size cannot
succeed, and being synchronous and string-only it would block the main thread
trying. A list is assembled from both stores on every read: wire records, with
locally edited ones overlaid in place, plus locally created ones appended. The
cache therefore stays a faithful copy of the wire and never absorbs an edit.

Windows: **one hour** for a list, **one day** for the article total. Nothing this
app does can change what the wire says, so staleness only guards against a
release being published elsewhere. `Refresh` in each list's toolbar forces a
re-sync past both cache layers; the toolbar also shows where the current rows
came from and how old they are, because invisible caching is the kind that gets
blamed for stale data.

Offline, a failed fetch falls back to the cache and reports the error alongside
the data rather than instead of it — the list stays usable and reconciles on the
next successful load.

## The total count

There is no count in the API, so it is discovered by probing for the end of the
collection with `Size=1` — at which point the page number *is* the row index, so
the answer is the last page that still returns a row.

Measured: a deep page costs ~1.15 s whether it returns 1 row or 100 (the time is
offset scanning, not serialisation), so single-row probes are the same latency
for 477 bytes instead of 48 KB. Probes run in parallel rounds of four, which
lands the count at **39 requests and ~24 s** from cold, then two requests a day
to confirm it hasn't moved. Concurrency is 4 rather than 16 deliberately: a round
of `k` probes narrows by `k + 1`, so higher `k` buys wall-clock at a steadily
worse price in requests.

Nothing waits on it. The releases list renders immediately and the footer fills
the total in when it arrives, so a page shows "Counting press releases…" only on
a genuinely cold start.

## Working and validating with the API off

The API runs on an Azure VM that gets switched off. When it is off, Cloudflare
answers **522** and then stops answering at all — and because a Cloudflare error
page carries no CORS headers either, the browser reports it with the *same*
message as a genuine CORS block. So "No 'Access-Control-Allow-Origin' header is
present" means either "the proxy is misconfigured" or "the VM is off", and the
console cannot tell you which.

### `npm run validate`

Separates them, by looking at what comes back rather than whether it worked:

| Response | Means |
| --- | --- |
| JSON array | Proxy good, API up. |
| **HTML** | Proxy **not applied** — the SPA catch-all answered. The `/wire` rewrite is missing, or is ordered after `/(.*)` in `vercel.json`. |
| 502 / 504 / 522 | Proxy good, API down. The request *was* forwarded. **With the VM off, this is the expected pass.** |
| nothing | The origin itself is unreachable. |

So the proxy can be validated with the API off, which is the whole point:

```
npm run validate                                   # a local dev server
npm run validate -- --url https://your.vercel.app  # the deployment
```

When the API is up it goes further and confirms it is really the wire on the
other end: the `Size<=100` cap returning 400, deep pages (page 90) answering,
events responding, and whether `GET /api/Events/{id}` is still broken. (It is,
as of 2026-09-23 — the working detail read is `GET /api/Events/{id}/full`.)

### `npm run dev:mock`

A local stand-in for the wire, so the app can be developed and demonstrated with
the VM off. `mock/server.mjs` is zero-dependency and seeded from
`mock/fixtures.json` — **real** responses captured from the live host, trimmed
but not reshaped — then cycled with renumbered ids up to the real collection
sizes (9,439 / 78,874 / 839), so paging boundaries, the total-count search and
the caching all meet the volumes they were built for.

It reproduces the wire's quirks deliberately, including the `Size` cap, the 500
on `GET /api/Events/{id}`, `""` and `" "` for absent strings, the organiser
repeated up to 168 times on one event, offsetless dates, and **no CORS headers**
— so going straight at it from a browser fails exactly as the real one does.

It serves the `/full` routes too, derived from the same fixtures so both shapes
describe the same records: `/api/Events/full` (published-only, deduped
organisers, `+08:00` offsets, absolute URLs, uncapped `PageSize`),
`/api/Events/{id}/full` (200, and 404 for an unpublished id — while
`/api/Events/{id}` beside it still answers 500), and
`/api/Companies/{id}/full`.

`dev:mock` points the *proxy target* at the mock, not the app's base URL: the
browser still calls `/wire`, so the proxy path stays exercised. Pointing the app
straight at the mock would validate the app while skipping the thing that broke
in production.

It is not a replica. Because records are cycled to reach the real totals,
anything derived from a *proportion* is off — 89 of 839 events read as
unpublished against 23 on the real wire. Counts, boundaries and per-record shapes
are faithful; ratios are not.

Nothing in `src/` imports `mock/`, and `tsconfig.app.json` only includes `src`,
so none of this reaches the production bundle.

## The browser never calls the API directly

The API's CORS is an **allowlist, not a wildcard**. An origin on the list gets an
`access-control-allow-origin` header back; every other origin gets none and the
browser blocks the response. `http://localhost:5173` was on it,
`http://localhost:5174` was not, and no deployed origin is — which is why the app
worked locally and rendered nothing on Vercel.

Asking for each new domain to be added upstream does not scale to preview
deployments and puts shipping behind someone else's config change. So requests
go through the app's own origin instead: the browser makes a same-origin request
to `/wire/*`, the server forwards it, and server-to-server traffic has no CORS.

Three places have to agree, all naming the same upstream:

| | What it does |
| --- | --- |
| `vercel.json` | Rewrites `/wire/:path*` → `https://development.acnnewswire.com/:path*`. **Must come before** the SPA catch-all — rewrites match in order, and `/(.*)` would otherwise swallow it and serve `index.html`. |
| `vite.config.ts` | `server.proxy` does the same for dev, with `changeOrigin` so the Host header matches for TLS/SNI. |
| `src/lib/api/client.ts` | `resolveBaseUrl()`: an explicit `VITE_API_BASE_URL` wins, else a browser uses `/wire`, else (Node — tests, scripts) the upstream directly, where there is no CORS. |

`/wire` rather than `/api` deliberately: Vercel treats a top-level `/api` path as
its serverless functions directory, and a rewrite colliding with that convention
is a trap for whoever adds the first function.

**Do not set `VITE_API_BASE_URL` to the upstream URL.** It overrides the proxy
and re-introduces the exact failure — see `.env.example`.

Two consequences worth knowing:

- The dev port no longer matters, so the `strictPort` pin has been removed. It
  existed only because the allowlist made port 5173 special.
- If the rewrite order were ever broken, `/wire/api/Companies` would return the
  SPA's `index.html` with a 200. `apiGet` rejects a non-JSON 200 rather than
  parsing it as data, and there is a test for that.

## The two facts that shaped everything

**1. Writes arrived late, and only for some records.** Until 2026-10 every
operation in the spec was a `GET`. The spec now carries writes, all behind a
Bearer JWT (`VITE_API_TOKEN`, see `.env.example`), for:

| Resource | Operations |
| --- | --- |
| Company | `POST /api/Companies`, `PUT` / `DELETE /api/Companies/{id}` |
| Industries | `PUT` / `DELETE /api/Companies/{companyId}/industries/{industryId}` |
| Listings | `POST /api/Companies/{companyId}/listings`, `PUT` / `DELETE …/listings/{mic}/{ticker}` |
| Social links | `PUT` / `DELETE /api/Companies/{companyId}/social-links/{platform}` |
| Events | `POST /api/Events`, `PUT` / `DELETE /api/Events/{id}` |

There is still **no write for articles, sectors, contacts, Bloomberg/wire codes,
RSS feeds, relations, wire services, delivery settings or status.** Those edits
stay local-only.

### Companies: base, draft, commit

Two local copies per company, never mixed (`lib/companies/storage.ts`):

| Key | Holds | Written by |
| --- | --- | --- |
| `acn_company_{id}` | **base** — the last version fetched from the API | fetches only |
| `acn_company_draft_{id}` | **draft** — uncommitted edits, autosaved | the editor and the sheet |

The diff is always base → draft, and there is exactly one diff engine
(`lib/companies/diff.ts`). Every change it produces carries its display (for the
commit dialog), a patch (to apply it to another copy), and the wire ops that send
it — or `sync: 'local'` with a reason, when the API has no endpoint for it. The
commit dialog, the commit and the "did it land" check all consume that one change
set; nothing diffs twice.

Commit (`lib/companies/sync.ts`):

1. **fetch** the API version fresh.
2. **conflicts** — anything both the draft and the API changed since the base,
   differently, stops the commit. The dialog offers "Overwrite with mine" or
   "Keep newswire version". Nothing is sent until one is chosen.
3. **rebase** the user's changes onto the fresh copy, so changes made elsewhere
   in the meantime are kept.
4. **send** the API-bound changes (`lib/api/write.ts` turns ops into requests).
5. **re-fetch** — this is the new base. "Did it land" is decided here, not by
   which requests answered 200.
6. **verify** — diff(new base, draft). Empty: the draft is deleted. Otherwise the
   draft is kept as exactly the leftover — unlanded API changes plus local-only
   ones — so the editor shows what is still outstanding and a retry resends only
   that.

A company created here has a draft and no base; its id starts at 9,000,001 so
it can never collide with a wire id. Its first commit POSTs, re-keys the draft to
the id the API returns, and continues from step 4.

Records from the old single-key layout (an edited copy under `acn_company_{id}`,
listed in `acn_company_edited`, or a record created here) are moved to the draft
key on first load, so no local edit is lost.

How a company maps back:

- `basicInfo` / `details` carry only changed fields. A cleared field is sent as
  `""` — on the Update DTOs null means "leave it".
- Logos and the annual report go back as **filenames** (the last URL segment).
  A `data:` upload preview is never sent: there is no upload endpoint.
- `addr1..addr4` are street, district, city, country, as on read. Six social
  links ride on `details`; **Instagram**, which has no details field, uses
  `/social-links/instagram`.
- **Industries are not sectors.** `/industries/{industryId}` takes ids from the
  API's own 43-entry industry taxonomy (1 = None, 2 = Aerospace & Defense …
  44 = Nanotechnology), held in `lib/industries.ts`. No endpoint lists it; it was
  read off the write responses on 2026-10-19. `/api/Sectors` ids (Aerospace &
  Defence = 211) are refused as "Unknown industry". So the editor has an
  **Industry** picker beside Sector; industries are sent by id, the first is
  primary (a `PUT … { isPrimary: true }` demotes the previous primary
  server-side). **Sectors have no write endpoint** and are local-only.
- **Listings are keyed by (mic, ticker)**; the read-side `exchangeId` values are
  MICs (`XTKS`, `XHKG`, `OOTC`). Position is `sortOrder`, and the first is primary.
  **Blocked on dev:** the API validates `mic` against an Exchanges table that is
  empty there, so every MIC is refused. Same for `countryCode` and the Countries
  table. `docs/seed/seed-lookups.sql` seeds both (sent to the API owner
  2026-10-19). Until then the listing read shape (`/full` → `listings[]`) is
  unconfirmed and the mapper still reads the legacy `tickers`.
- A create's response is undeclared; `createdId` accepts a bare number or
  `{ id | companyId | compId | eventId }`. The local draft is re-keyed to the new
  id at once, so a retry after a partial failure cannot POST a duplicate. If no
  id comes back the commit stops and says so, rather than risk a second create.

Deletes have **no** local fallback: a delete that only happened here would come
back on the next sync, so a refused delete removes nothing.

Verified live against the dev host, 2026-10-19 / 2026-10-21 (test company
9922, created and deleted through the app's own commit and delete):

- **Writes need no token on dev.** `VITE_API_TOKEN` is unused there for now.
- **Create** returns `201 {"companyId": n}`.
- **Where writes land in `/full`:** `/industries` → `industries[]`
  (`{ id, name, isPrimary }`), `/social-links` → `socialLinks[]`
  (`{ platform, url }`), both separate from the legacy `sectors`, `tickers` and
  `socials` beside them. The six `details` socials land in `socials`.
  `legalName` lands in `legalName`. The mapper reads all of these, so step 6
  sees them as landed — proven by a full commit (add, reorder, remove) that
  ended with an empty draft.
- `platform` spelling: lowercase, `instagram`.

Articles still use the older single-copy layout: `cacheArticle` writes an API
record into the keyspace the editor reads from, but never over one marked edited.

**2. The spec declares no response schemas.** Every 200 is a bare
`{"description": "OK"}`. Nothing could be generated: the types in
`src/lib/api/types.ts` are transcribed from live responses, and the fixtures in
`map-company.test.ts` / `map-article.test.ts` are real trimmed responses so the
mappers are tested against what the server actually sends.

## Layout

| File | What it is |
| --- | --- |
| `src/lib/api/repository.ts` | Load a record without caring whether it came from the API or localStorage. What the pages use. |
| `src/lib/api/map-company.ts` | Wire company → `CompanyFull`. |
| `src/lib/api/map-article.ts` | Wire article → `PressRelease`. |
| `src/lib/api/endpoints.ts` | One function per swagger operation, reads and writes. |
| `src/lib/api/write.ts` | `CompanyFull` → the write DTOs, and the push. |
| `src/lib/companies/diff.ts` | The one company diff: base → draft, with patches and wire ops. |
| `src/lib/companies/sync.ts` | Company commit (fetch, conflicts, send, re-fetch, verify) and delete. |
| `src/lib/events/write.ts` | Event save/delete, with its pending-draft fallback. |
| `src/lib/api/types.ts` | The wire shapes. |
| `src/lib/api/cache.ts` | The IndexedDB read cache. |
| `src/lib/api/media.ts` | Image filenames → URLs. |
| `src/lib/api/client.ts` | fetch, base URL, `ApiError`. |
| `src/hooks/useRecords.ts` | React Query bindings over the repository. |

## What is wired

| Surface | Source |
| --- | --- |
| Companies list | `GET /api/Companies`, all 9,439, cached; display paginated |
| Company editor | `GET /api/Companies/{id}/full` — one call, was three |
| Press releases list | `GET /api/Articles`, one page at a time, each page cached |
| Press release editor | `GET /api/Articles/press-release/{artId}` |
| Companies sheet | The same full 9,439 as the list |
| Releases sheet | The first page — a sheet is a bulk-edit surface, not a browsing one |
| Events list | `GET /api/Events/full` (816) + legacy `GET /api/Events` for the 23 unpublished, cached; display paginated |
| Company save / delete | `PUT`/`POST`/`DELETE /api/Companies…` plus industries, Instagram (verified live) and listings (blocked on dev) — see above |
| Event detail | The cached set, else `GET /api/Events/{id}/full`, else the legacy sweep |
| Event save / delete / create | `PUT`/`DELETE /api/Events/{id}`, `POST /api/Events` |
| Event releases | `GET /api/Events/company/{compId}/year/{year}` |

The remaining endpoints (`/api/Articles/homepage`, `/by-industry`, `/search`,
`/by-company/{id}`) have typed functions and mappers but no screen calling them
yet: nothing in the current UI corresponds to them. `mapArticleFeedItem` handles
the feed row shape those endpoints return.

## Events

The event types implement the **public site's published contract**
(`schemas/events.json`) rather than a shape of this app's own, so the admin and
the site agree on what an event is. Every claim in that contract was checked
against the live wire and all of them hold, across all 839 events. Two things it
records were things this codebase had wrong:

- `eventImage` resolves to **`/eventimages/`**, its own top-level path — not
  `/images/events/`, which was an unverified guess here. The 404 that seemed to
  confirm a missing asset was really the wrong directory.
- `GET /api/Events/company/{id}/year/{year}` returns **press releases, not
  events**. It was typed as `ApiEvent[]`; it returns `ApiEventRelease`
  (`articleId`, `headline`, `summary`, `systemDate`, `companyId`).

Three transforms are contract requirements, not local taste — changing any of
them changes what the site renders:

1. **Dates gain an explicit `+08:00`.** The wire sends an offsetless date-only
   midnight, which a browser reads in the *viewer's* zone — so an event on the
   16th shows as the 15th anywhere west of the wire. `lib/events/format.ts`
   reads these back as text for the same reason: a `toLocaleDateString()` would
   undo the fix.
2. **`endDate` is pushed to 23:59:59.** The wire gives the final day at
   midnight, so an event reads as finished for the whole of its last day.
3. **`companies` is deduped by id.** The wire repeats the organiser once per
   release it has — 168 identical copies on the worst event. No event carries
   two *distinct* companies, so collapsing loses nothing.

As of 2026-09-23, **`/api/Events/full` does all three upstream** — real `+08:00`
offsets, `endDate` at 23:59:59, organisers deduped — and returns `url` and
`photo` absolute besides. `mapEventFull` still applies each transform anyway.
They are no-ops on well-formed input, and keeping them means a backend
regression degrades to the old repair behaviour rather than shipping a relative
`href` or an off-by-one-day date. The legacy `mapEvent` is unchanged and still
does the real work for the 23 unpublished events, which only the legacy route
serves. A unit test asserts the two mappers produce an identical record for the
same event, because the list renders rows from both.

What the shape of the data forces on the UI:

- **718 of 839 events have no `compId`**, and it is the only key linking an
  event to its releases — so "no release feed" is the normal case, not an error.
- **23 of 839 are unpublished** (`publish` is `"y"` or a blank, never `"n"`).
  That field is not on the contract, so it cannot ride on the record; it comes
  back alongside it from the same fetch as `unpublishedIds`.
- One deliberate deviation: the contract says URLs are normalised to `https://`,
  and an already-absolute `http://` one is left alone instead. Event 507
  (`http://www.battery-expo.com`) is the only such record and that host does not
  answer on https at all — the http URL returns 200, the https one fails to
  connect. What the contract actually needs is *absolute rather than relative*,
  which is still satisfied.

### Writing

Live as of 2026-10-13: `POST /api/Events`, `PUT /api/Events/{id}`,
`DELETE /api/Events/{id}`, wired in `lib/events/write.ts`. The detail page saves
and deletes; `/events/new` creates.

The write DTO uses the `/full` names, not the legacy ones the old benched payload
guessed at: `name` (not `description`), `isPublished: boolean` (not `"y"`/`" "`),
`organiserId` (not `compId`), and date-only `YYYY-MM-DD` dates — the `+08:00` and
`23:59:59` are read-side repairs and are never sent back.

A save writes the draft to localStorage (`acn_event_draft_{id}`, or `_new`)
before sending, and clears it only once the API accepts it. A failed send leaves
it there; the detail page reopens it with a "restored" notice and the next Save
retries. After a successful save the event list is force-refreshed, since an
unpublished event only shows up through the legacy sweep.

## The blanks

These fields have no source in the API. They keep their blank-record default —
nothing is guessed.

**Companies**

| Field | Why |
| --- | --- |
| `created_at`, `updated_at`, `created_by`, `updated_by` | The API exposes no audit timestamps at all. Left empty rather than stamped with the fetch time, which would show every company as modified today — the list's Modified column renders `—`. |
| `status` | No equivalent field. A company off the wire is mapped `active`, not `draft`. |
| `instagram` | Not in the legacy `socials`; read from `/full` → `socialLinks[]` (platform `instagram`). Blank on every legacy company. |
| `relations`, `wire_services` | No endpoint. |
| `rss_feeds` | Partly closed 2026-09-23. `/api/Companies/{id}/full` → `rss[]` is `{ compId, id, rssName }` (company 574 populates it). Only the feed's NAME is on the wire — no url, sector or status — so `mapRssFeed` fills the name and leaves the rest at the blank default. |
| `sedol`, `cusip` | Ticker rows carry only `isin`. |
| `delivery_settings` | Only `allow_access` has a source (`allowAccess`). |
| `contact_type` | The API's `format` describes the email body (`"HTML"`), which is `email_format` — a different field. |

**Press releases**

| Field | Why |
| --- | --- |
| `created_at`, `updated_at` | As above. |
| `status` | No field. Inferred from `publishDate`: future → `scheduled`, past → `published`, none → `draft`. Nothing maps to `archived`. |
| `topic` | `topicName` is the constant `"Press release summary"` on every record sampled — a section label, not a topic. Mapping it would give every release the same wrong topic. |
| `region`, `article_type`, `tracking_id`, `distribute_to`, `report_by`, `send_by`, `custom_about_html` | No field. |
| `contacts` | The article endpoints carry none. Company contacts are a different thing and are not substituted in. |
| `translations` | The list row's `language` describes the record in hand; nothing links the language variants of one release to each other. |

The API's article `images` array has no home in the model at all — `PressRelease`
has no image gallery, and the photos are not in `bodyHtml` either.
`articleImageUrls` exposes them so a caller can use them without the mapper
inventing a field.

## Response-reading fixes — 2026-09-16

Three mapper changes. All are about how a response is READ; no endpoint, no
request and no model shape changed. Finding ids match `../../contracts/`.

**AC-M1 — sectors now resolve by NAME, not by id.** `mapSector` matched
`SECTORS.find(s => s.id === api.id)`, assuming the API's sector ids index
`lib/sectors.ts`. They do not — the two id spaces are unrelated, and because
both are dense small integers a wrong id resolved to a *real* sector instead of
to nothing. Company 82 (Mitsubishi Heavy Industries) was coming out tagged
**Fashion & Apparel** (id 208, actually "Engineering") and **eSports Gaming**
(id 252, actually "EVs, Transportation"), written into `CompanyFull` and cached.
Name-matching fixes four of its seven; the other three names are absent from
`lib/sectors.ts` under any id, so the wire's own name and description are kept
verbatim rather than guessed at. The wire's `id` is still stored in `sector_id`,
because the mapping between the two taxonomies is an open question with the API
team and keeping it means the answer can be applied without re-probing.
`map-article.ts` already matched by name, so before this the two mappers
disagreed with each other about the same company.

`sectorFromId` — the fallback built from the company's own `sectorId` column —
has no name to match on, so it can only go by id. It now returns **no sector**
when the id is unresolvable, instead of a row with an empty `sector_name`.
Company 82 sends `sectorId: 186`, which matches nothing; the old behaviour
produced a blank-named sector the editor could neither read nor fix, and which
was indistinguishable from a company that genuinely has none.

**AC-M2 — portal credentials: FIXED UPSTREAM 2026-09-23.** `/api/Companies` and
`/api/Companies/{id}` used to return `username` and `password` in plaintext on
an endpoint that needs no sign-in. This app syncs all 9,606 companies, so
mapping them wrote 9,606 plaintext credential pairs into IndexedDB, where they
persisted across sessions. The backend now strips them — re-verified on the
list, detail, `/details` and `/full` routes, none of which returns either field.
`blankCompany` still leaves `portal_username`/`portal_password` null, nothing
reads them, and nothing should start. Kept on the record because the mitigation
(not reading them) is what protected us while the leak was live.

**AP-M3 — `language` is read from the press-release response.** The comment on
`mapPressRelease` said the detail endpoint has no language field and that the
value had to be threaded in from a cached list row. It does return one, on every
record sampled. The old behaviour lost the language on a cold cache — a direct
URL open, or after IndexedDB was cleared — and fell back to English while the
correct value sat in the response. `options.language` is kept as a fallback so
every existing caller works unchanged; the response wins when it has an answer.

Each fix has regression tests that fail if it is reverted: `map-company.test.ts`
asserts a heavy industrial firm is not tagged Fashion & Apparel, and
`map-article.test.ts` pins the language precedence including the cold-cache case.
344 tests pass; `tsc -b` is clean.

The same pass fixed two matching defects in `newsroom-main` — see
`newsroom-main/docs/api-response-fixes-2026-09-16.md`.

## Decisions worth knowing about

**Two "derived unless overridden" flags are set to `true` on API records.** That
reads backwards but is the point: both derivations run off *local* state, and
against a record whose companies aren't in localStorage they would replace real
wire data with blanks.

- `classification_overridden` — Sector and Industry come from the wire's own
  `sectors` array, resolved against `lib/sectors.ts`. Left recomputing, they
  would derive from local company records and empty out.
- `dateline_overridden` — set whenever there is a body. `parseDateline` cannot
  see a wire dateline: its rule requires plain text whose first word is ALL
  CAPS, and the wire wraps the dateline in `<strong>` (rejected as markup) while
  CJK datelines have no capitals at all. With the flag left false, typing a
  Location into a wire-sourced release lets `applyAutoDateline` prepend a
  *second* dateline in front of the one already in the body.

**Language tags are translated.** The wire sends `ZH-CN` / `ZH-TW`; the model
uses the script-based `ZH-HANS` / `ZH-HANT`. Those four plus `EN` and `JA` are
every value seen across 500 sampled articles.

Note the wire's tags are *region* codes and the model's are *script* codes —
they are not the same kind of tag. `newsroom-main` independently settled on a
third spelling (BCP-47 `zh-Hant`), and both repos' `languages.ts` describe
themselves as the single source of truth. Any shared client has to pick one.

**A company is spread over three endpoints**, each authoritative for a different
slice, so `mergeCompanyDetail` never lets a blank from one erase a value from
another:

- `/api/Companies/{id}` — sectors, tickers, Bloomberg codes, social links
- `/api/Companies/{id}/details` — address (`addr1`..`addr4` are street,
  district, city, country), key people, established/employees/DUNS
- `/api/CompContacts` — superseded by `/full`, which embeds the same rows with
  the same fields. Was the only source for a contact's position, fax,
  description and email format
- `/api/Companies` (list) — the only source for the annual report and
  `extBoilerPlate`

**Bloomberg codes go through `codeHash`**, the same hash the Identifiers tab
uses, so a code added by hand and the same code arriving from the API share one
id and cannot end up on the record twice. `code_type` comes from
`BLOOMBERG_CODES`, which the API has no field for.

## Media paths

The API returns bare filenames, never URLs, and the three kinds live on three
different hosts/paths. Each was confirmed by fetching a filename taken from a
live response:

| API field | Resolves to |
| --- | --- |
| `logoFilename` / `logoFileName` | `https://www.acnnewswire.com/images/company/` |
| `topLogoFilename` / `topLogoFileName` | `https://www.acnnewswire.com/images/toppage/` |
| `bigImage` / `thumbImage` | `https://photos.acnnewswire.com/` |

Two are **unverified guesses** in the house style, marked as such in
`media.ts` — confirm before relying on them:

- `reportFilename` (annual report) → `/images/report/`. No company in the
  sampled pages had a `reportFilename`, so there was nothing to test against.
- `eventImage` → `/images/events/`. Every candidate 404'd for the one sample
  available (`ir_magazine.jpg`, from a 2007 event whose asset has most likely
  been removed).

## Server-side quirks observed

- **`GET /api/Events/{id}` still returns 500** for every id tried (163, 177,
  155, 1), including ids taken straight out of the list response. The fix landed
  on **`GET /api/Events/{id}/full`**, which works — the broken route was left as
  it was rather than repaired, so do not call it.
- **The `/full` projections are published-only.** `/api/Events/full` omits the
  23 unpublished events and `/api/Events/{id}/full` 404s for them, which reads
  identically to "no such event". The legacy sweep is the only place they exist.
- **`PageSize` on `/api/Events/full` is uncapped**, unlike `Size` elsewhere —
  2000 returns the whole set in one request.
- **`GET /api/Articles/search` is exact-match, not substring.**
  `CompanyName=Umetal` came back empty for a company that exists. Prefer
  filtering `fetchArticles` client-side unless you have exact values.
- **`GET /api/Articles/homepage` returned `[]`** on the dev host.
- **No total count anywhere.** No envelope, no count header, no `Link` header.
  The end of a collection is discoverable only by a short page.
- **Paging casing is inconsistent.** `/api/Articles`, `/api/Articles/search`,
  `/api/Companies` and `/api/Companies/{id}` take `Page`/`Size`;
  `/api/Articles/by-industry`, `/by-company` and `/api/Events` take
  `pageNumber`/`pageSize`; `/api/Events/full` takes `PageNumber`/`PageSize`.
  Three casings. `Size` is capped at 100; `PageSize` on `/api/Events/full` is
  not.
- **Field casing is inconsistent.** `companyId` on list and contact rows,
  `companyID` on the company nested in an article; `logoFilename` vs
  `logoFileName`. The mappers absorb this.
- **`""` is used as freely as `null`.** Every mapper collapses blank strings to
  `null`, or "no value" would render as a set-but-empty field. A single space is
  also used for "no phone".
- **Auth**: the spec declares a `Bearer` JWT scheme, but the dev host serves all
  reads without one. `setAuthToken` is there for when that changes.
- **CORS is an allowlist.** See the section above; the app proxies around it.
- **The host goes down.** Observed returning Cloudflare **522** (origin
  unreachable) from every origin including server-side with no `Origin` header.
  A 522 error page carries no CORS headers either, so an outage and a CORS block
  produce the *same* console message — check whether the API answers at all
  before assuming CORS.
