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
| Companies | **9,439** | 4.3 MB | ~2 s at concurrency 8 |
| Articles | **78,874** | ~70 MB | minutes |
| Events | **839** | 1.5 MB | ~1 s |

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
- **Events are fetched in full**, like companies — and they have no choice:
  `GET /api/Events/{id}` answers 500, so the cached list is the only way to open
  a single event.

## Caching, and what is stored where

Loading is **cache-first**, which is what keeps the API quiet and what makes the
app work offline. Two stores, two jobs, and the difference matters:

| | `lib/api/cache.ts` (IndexedDB) | `lib/*/storage.ts` (localStorage) |
| --- | --- | --- |
| Holds | what the wire said | edits, and records created here |
| Disposable? | Yes — drop it any time, costs a re-fetch | **No.** The only copy, because the API is read-only |
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

## Dev server port

`vite.config.ts` pins port 5173 with `strictPort`. The API's CORS is an
**allowlist, not an echo**: `http://localhost:5173` gets an
`access-control-allow-origin` header and `http://localhost:5174` gets none. Vite
would otherwise quietly move to the next free port and every request would fail
CORS — a symptom that looks nothing like "wrong port".

## The two facts that shaped everything

**1. The API is read-only.** All thirteen operations in the spec are `GET`.
There is no `POST`/`PUT`/`PATCH`/`DELETE` for companies, articles or events, so
there is no write path and no reverse mapper. Editing still goes to
localStorage exactly as before.

That gives localStorage two jobs at once — a cache of what the wire said, and
the only home for an edit. `cacheCompany` / `cacheArticle` keep them apart:
they write an API record into the same keyspace the editor reads from, but never
over a record that has been edited locally. `saveCompany` / `saveArticle` mark a
record as edited, and from then on the wire cannot overwrite it.

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
| `src/lib/api/endpoints.ts` | One function per swagger operation. All thirteen. |
| `src/lib/api/types.ts` | The wire shapes. |
| `src/lib/api/cache.ts` | The IndexedDB read cache. |
| `src/lib/api/media.ts` | Image filenames → URLs. |
| `src/lib/api/client.ts` | fetch, base URL, `ApiError`. |
| `src/hooks/useRecords.ts` | React Query bindings over the repository. |

## What is wired

| Surface | Source |
| --- | --- |
| Companies list | `GET /api/Companies`, all 9,439, cached; display paginated |
| Company editor | `GET /api/Companies/{id}` + `/details` + `/CompContacts`, merged |
| Press releases list | `GET /api/Articles`, one page at a time, each page cached |
| Press release editor | `GET /api/Articles/press-release/{artId}` |
| Companies sheet | The same full 9,439 as the list |
| Releases sheet | The first page — a sheet is a bulk-edit surface, not a browsing one |
| Events list | `GET /api/Events`, all 839, cached; display paginated |
| Event detail | The cached list — there is no working detail endpoint |
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

### Writing is benched

`lib/events/write.ts` holds a complete write path with the request removed. The
form, its validation and its change tracking are real and tested; `Save` reports
the payload it *would* have posted. It is benched because there is nothing to
call — every operation in the spec is a `GET` — and `PROPOSED_ENDPOINTS` records
what would have to exist: `POST /api/Events`, `PUT /api/Events/{id}`,
`DELETE /api/Events/{id}`, plus a working `GET /api/Events/{id}` for read-back.

Turning it on is `EVENTS_WRITE = true` plus a request in `submitEventDraft`. The
flag on its own only turns a refusal into a broken request, which is why
`submitEventDraft` throws rather than silently no-ops if it is flipped early.

## The blanks

These fields have no source in the API. They keep their blank-record default —
nothing is guessed.

**Companies**

| Field | Why |
| --- | --- |
| `created_at`, `updated_at`, `created_by`, `updated_by` | The API exposes no audit timestamps at all. Left empty rather than stamped with the fetch time, which would show every company as modified today — the list's Modified column renders `—`. |
| `status` | No equivalent field. A company off the wire is mapped `active`, not `draft`. |
| `instagram` | The API has blog/facebook/twitter/youTube/linkedIn/telegram, no Instagram. |
| `relations`, `wire_services` | No endpoint. |
| `rss_feeds` | `/api/Companies/{id}` has an `rss` array, but it was empty for every company sampled, so the row shape is unknown. |
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

**A company is spread over three endpoints**, each authoritative for a different
slice, so `mergeCompanyDetail` never lets a blank from one erase a value from
another:

- `/api/Companies/{id}` — sectors, tickers, Bloomberg codes, social links
- `/api/Companies/{id}/details` — address (`addr1`..`addr4` are street,
  district, city, country), key people, established/employees/DUNS
- `/api/CompContacts` — the only source for a contact's position, fax,
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

- **`GET /api/Events/{id}` returns 500** for every id tried (163, 177, 155, 1),
  including ids taken straight out of the list response. There is no working
  detail endpoint for events at all.
- **`GET /api/Articles/search` is exact-match, not substring.**
  `CompanyName=Umetal` came back empty for a company that exists. Prefer
  filtering `fetchArticles` client-side unless you have exact values.
- **`GET /api/Articles/homepage` returned `[]`** on the dev host.
- **No total count anywhere.** No envelope, no count header, no `Link` header.
  The end of a collection is discoverable only by a short page.
- **Paging casing is inconsistent.** `/api/Articles`, `/api/Articles/search`,
  `/api/Companies` and `/api/Companies/{id}` take `Page`/`Size`;
  `/api/Articles/by-industry`, `/by-company` and `/api/Events` take
  `pageNumber`/`pageSize`. `Size` is capped at 100.
- **Field casing is inconsistent.** `companyId` on list and contact rows,
  `companyID` on the company nested in an article; `logoFilename` vs
  `logoFileName`. The mappers absorb this.
- **`""` is used as freely as `null`.** Every mapper collapses blank strings to
  `null`, or "no value" would render as a set-but-empty field. A single space is
  also used for "no phone".
- **Auth**: the spec declares a `Bearer` JWT scheme, but the dev host serves all
  reads without one. `setAuthToken` is there for when that changes.
- **CORS** already allows `http://localhost:5173` (Vite's default port).
