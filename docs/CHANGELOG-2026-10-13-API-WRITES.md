# Change log — API write integration and diff engine rewrite

**Date:** 2026-10-13
**Branch:** `master`, uncommitted (working tree only)
**Base commit:** `c4733a6 new API endpoints`
**Status:** typecheck clean, production build clean, 18 test files / 377 tests passing.
Not yet exercised in a browser or against the real API with a token.

This session had two rounds of work:

1. **Wiring the new write endpoints** — companies (and their industries, listings,
   social links) and events can now be created, updated and deleted.
2. **Rewriting the company diff engine and save model** — after review, the first
   round's save path was replaced: the diff is now *API version vs local draft*,
   edits autosave locally, and commit sends to the API, re-fetches, and verifies.

Round 2 superseded parts of round 1. The final state is what is described under
"Final architecture"; the per-round sections record how it got there.

---

## 1. What the API offers now

Checked against the live spec (`/swagger/v1/swagger.json`) on 2026-10-13. All
writes require a **Bearer JWT**.

| Resource | Operations |
| --- | --- |
| Company | `POST /api/Companies`, `PUT /api/Companies/{id}`, `DELETE /api/Companies/{id}` |
| Company industries | `PUT` / `DELETE /api/Companies/{companyId}/industries/{industryId}` |
| Company listings | `POST /api/Companies/{companyId}/listings`, `PUT` / `DELETE …/listings/{mic}/{ticker}` |
| Company social links | `PUT` / `DELETE /api/Companies/{companyId}/social-links/{platform}` |
| Events | `POST /api/Events`, `PUT /api/Events/{id}`, `DELETE /api/Events/{id}` |
| (read) Sectors | `GET /api/Sectors` — the wire's own sector ids |

Findings from probing (reads only — nothing was written to the dev host):

- `exchangeId` values on reads are MIC codes (`XTKS`, `XHKG`, `OOTC`), so a
  listing's `mic` = the app's `exchange_id`.
- `/api/Sectors` uses the same id space as `/full` (Aerospace & Defence = 211),
  which is *not* the id space of `src/lib/sectors.ts`.
- `GET /industries`, `/listings`, `/social-links` returned `[]` for every company
  probed, including company 82 whose `/full` record has four tickers. They appear
  to read a different store than `/full`.

## 2. Write endpoints that do NOT exist

Edits to these stay in the local draft and are tagged **"local only"** in the
commit dialog.

**Companies**

| Data | Missing |
| --- | --- |
| Contacts | create / update / delete (only `GET /api/CompContacts`) |
| Bloomberg / wire codes | create / delete |
| RSS feeds | create / update / delete |
| Related companies (relations) | no endpoint at all, not even a read |
| Wire services | no endpoint at all, not even a read |
| Delivery settings (allow access, photos, banner, company will mail, extended boilerplate flag, archives, alerts, delivery method) | no fields |
| Status (active / inactive / draft) | no field |
| Languages (main / secondary) | no field |
| Portal username / password | no field |
| Listing ISIN / SEDOL / CUSIP | listing DTO takes only mic, ticker, isPrimary, sortOrder |
| Logo and annual-report files | no upload endpoint — only filenames can be stored |

**Press releases / articles:** no write endpoints at all.

**Events:** complete.

---

## 3. Final architecture

### Companies: base, draft, commit

Two local copies per company, never mixed (`src/lib/companies/storage.ts`):

| localStorage key | Holds | Written by |
| --- | --- | --- |
| `acn_company_{id}` | **base** — last version fetched from the API | fetches and commit re-fetches only |
| `acn_company_draft_{id}` | **draft** — uncommitted edits | editor autosave, sheet view |

- The editor autosaves the draft on every change; the draft is deleted the moment
  it matches the base.
- The diff is always **base → draft**, computed by one engine.
- Commit flow (`src/lib/companies/sync.ts`):
  1. **Fetch** the API version fresh.
  2. **Conflict check** — fields both the draft and the API changed since the
     base, differently. If any, nothing is sent; the dialog asks
     "Overwrite with mine" or "Keep newswire version".
  3. **Rebase** the user's changes onto the fresh copy (changes made elsewhere
     meanwhile are kept).
  4. **Send** API-bound changes.
  5. **Re-fetch** — this becomes the new base.
  6. **Verify** — diff(new base, draft). Empty → draft deleted. Otherwise the draft
     is kept as exactly the leftover (unlanded API changes + local-only changes),
     so a retry resends only that.
- New companies (created in the app) have a draft and no base. Their first commit
  POSTs, re-keys the draft to the id the API returns, then continues at step 4.
- Delete: API `DELETE` first; local copies removed only if it succeeds. A company
  never committed is deleted locally only.

### The diff engine (`src/lib/companies/diff.ts`)

- **`FIELDS`** — every scalar field listed once, with label, section and where it
  goes on the wire (`basicInfo.*`, `details.*`, social-links, or `local` + reason).
- **`COLLECTIONS`** — every list keyed by a stable identity:
  sectors by **name**, listings by **(mic, ticker)**, contacts / wire codes / RSS /
  relations / wire services by id. Sectors and listings are ordered (first =
  primary); order/primary changes are their own change.
- Each change carries:
  - display data for the commit dialog,
  - a **patch** (`applyChanges` applies it to another copy — used for rebasing and
    for keeping only the leftover after a commit),
  - its **wire ops** (or `sync: 'local'` with a reason).
- `findConflicts(mine, theirs)` compares two change sets by key.
- `""` and `null` are treated as equal; a cleared field is sent as `""` (null on
  the update DTOs means "leave it").
- Logos/annual report go to the wire as filenames; `data:` upload previews are
  local-only.
- A test asserts every `CompanyFull` field is covered by `FIELDS`, `COLLECTIONS`
  or `IGNORED_FIELDS`, so a new field cannot be silently skipped.

### Requests (`src/lib/api/write.ts`)

No diffing — only ops → HTTP:

- `basicInfo` / `details` ops merged into one `PUT /api/Companies/{id}`.
- Industry ops resolve the industry id by **name** via `GET /api/Sectors`
  (fetched lazily, once per session).
- Listing and social-link ops: one request each.
- `createFromChanges` POSTs a new company; throws if no id comes back (to avoid a
  duplicate create on retry).

### Events

- `src/lib/events/write.ts`: the benched write path is live. Payload uses the
  real DTO names: `name`, `isPublished: boolean`, `organiserId`, date-only
  `YYYY-MM-DD` dates, bare URL.
- Save is local-first: draft written to `acn_event_draft_{id}` (or `_new`) before
  sending, cleared on success. A failed save is restored on the detail page with a
  notice; the next Save retries.
- `src/lib/events/storage.ts` (new): pending event drafts.
- Event detail page: Save, Delete (with confirm), Discard, a Published checkbox,
  and create at `/events/new`. Events list: "+ New event" enabled.

### Transport

- `src/lib/api/client.ts`: new `apiSend(method, path, body)` beside `apiGet`
  (shared request function: JSON body, Bearer header, `ApiError`, empty write
  body → `null`).
- Token read from **`VITE_API_TOKEN`** until a login flow exists (documented in
  `.env.example`; must not be set in a deployed build).

---

## 4. Round 1 — write integration (as first built)

Scope approved: Phase 1 (core writes) + Phase 2 (sub-resources), localStorage
fallback automatic, light tests.

- `client.ts`: `apiSend`, `VITE_API_TOKEN`.
- `types.ts`: write DTOs (`CreateCompanyDto`, `UpdateCompanyDto`,
  `ApiCompanyBasicInfo`, `ApiCompanyDetailsWrite`, `SaveCompanyIndustryDto`,
  `CreateCompanyListingDto`, `UpdateCompanyListingDto`,
  `SaveCompanySocialLinkDto`, `SaveEventDto`, `ApiSector`).
- `endpoints.ts`: one function per write operation, `fetchSectors`, `createdId`.
- `write.ts` (new): company → DTO mapping with its own diff against a fresh
  `/full` read, sub-resource planning, push.
- `companies/sync.ts` (new): save to localStorage, then push; delete.
- `repository.ts`: `patchCachedCompany` (patches the cached company list in place
  instead of forcing a 95-page re-sync). `cache.ts`: `cacheSet` takes optional
  `savedAt`.
- `CommitModal` / `CompanyEditor`: commit pushes to the API; Delete button added.
- Events: as described in §3.
- Mock server: accepts POST/PUT/DELETE on the write routes, logs them, returns
  `{ id }` on create. Not persisted.
- Docs: `API-WIRING.md` read-only sections rewritten.

**Problems found in review** (which led to round 2):

- The local store held *either* the API copy *or* the edited copy, so the true
  base was lost once a company was edited.
- Editor edits lived only in memory until commit — a refresh lost them.
- Two diffs disagreed: `computeDiff` (shown in the dialog) and the push's own diff
  covered different fields and keyed sectors/listings differently.
- After a failed sync the editor's diff was empty, and the commit dialog offers no
  Commit button for an empty diff — so a pending sync could not be retried.
- Commit copied the local draft into the base instead of re-fetching what the API
  actually stored.

## 5. Round 2 — diff engine and save model rewrite

| File | Change |
| --- | --- |
| `src/lib/companies/diff.ts` | Rewritten as the single engine (§3). `computeDiff` kept as an alias. |
| `src/lib/companies/storage.ts` | Rewritten: separate base / draft keys; `loadCompany`/`loadCompanies` return the working copy (draft ?? base); `saveCompany` now saves a draft; local ids start at **9,000,001** (old scheme 1000+ could collide with wire ids); migration of the old layout. |
| `src/lib/companies/sync.ts` | Rewritten: `commitCompany` (fetch → conflicts → rebase → send → re-fetch → verify), `emptyBase`, `deleteCompanyEverywhere`. |
| `src/lib/api/write.ts` | Rewritten: ops → requests only (`sendChanges`, `createFromChanges`, `fieldBody`). |
| `src/lib/api/repository.ts` | `fetchCompanyBase` (mapped + normalised, so fresh and stored copies compare equal); `loadCompanyRecord` returns `{ base, draft, fresh }` and always refreshes the base; skips fetching for companies created locally. |
| `src/store/company.store.ts` | `original` = base, `draft` autosaved, `changes` computed synchronously, `open`, `committed`, `baseMissing` (opened offline with no cached base), `saveError` (autosave failed). `resetDraft` deletes the draft and preserves the "created here" marker. |
| `src/types/company.types.ts` | Changes gain `key`, `sync: 'api' \| 'local'`, `reason`. |
| `src/pages/companies/CompanyEditorPage.tsx` | Opens with base + draft (draft read straight from storage, not the query cache); empty base for new companies; stand-in base when offline. |
| `src/pages/companies/index.tsx` | Row click no longer seeds the editor with the partial list row; "+ New company" uses `nextCompanyId`. |
| `src/components/company/modals/CommitModal.tsx` | Rewritten around `commitCompany`; conflict handling; toasts for landed / unlanded / local-only / unverified. |
| `src/components/company/modals/CommitDialog.tsx` | "local only" tag per row; conflict view with "Overwrite with mine" / "Keep newswire version"; committing state. |
| `src/components/company/CompanyEditor.tsx` | Uses store `changes`; "N uncommitted changes · saved locally" hint; navigation only blocked if autosave failed; Delete targets the draft; button renamed **Commit changes**. |
| `src/components/ui/ui.css` | `.commit-row__local` tag style. |

**Migration:** records from the old layout — an edited copy under
`acn_company_{id}` listed in `acn_company_edited`, or a record created locally —
are moved to the draft key on first load. Nothing is lost; the base is re-fetched
when the company is next opened.

---

## 6. All files touched

**New**

- `src/lib/api/write.ts`
- `src/lib/companies/sync.ts`
- `src/lib/companies/diff.test.ts`
- `src/lib/companies/sync.test.ts`
- `src/lib/events/storage.ts`
- `docs/CHANGELOG-2026-10-13-API-WRITES.md` (this file)

**Modified**

- `.env.example` — `VITE_API_TOKEN`
- `docs/API-WIRING.md` — write endpoints, base/draft/commit model, mapping rules, unverified items
- `mock/server.mjs` — write routes
- `src/components/company/CompanyEditor.tsx`
- `src/components/company/modals/CommitDialog.tsx`
- `src/components/company/modals/CommitModal.tsx`
- `src/components/ui/ui.css`
- `src/hooks/useRecords.ts` — comment only
- `src/lib/api/cache.ts` — `cacheSet(key, value, savedAt?)`
- `src/lib/api/client.ts` — `apiSend`, token
- `src/lib/api/client.test.ts` — `apiSend` test
- `src/lib/api/endpoints.ts` — write functions, `fetchSectors`, `createdId`
- `src/lib/api/index.ts` — exports, header comment
- `src/lib/api/map-company.ts` — comment only
- `src/lib/api/repository.ts`
- `src/lib/api/types.ts` — write DTOs, `ApiSector`
- `src/lib/companies/diff.ts`
- `src/lib/companies/storage.ts`
- `src/lib/events/events.test.ts` — bench tests replaced with real payload/fallback tests
- `src/lib/events/write.ts`
- `src/lib/press-releases/storage.ts` — comment only
- `src/lib/sheet/commit.test.ts` — new local id expectation (9,000,001)
- `src/pages/companies/CompanyEditorPage.tsx`
- `src/pages/companies/index.tsx`
- `src/pages/events/EventDetailPage.tsx`
- `src/pages/events/index.tsx`
- `src/store/company.store.ts`
- `src/types/company.types.ts`

**Deleted**

- `src/lib/api/write.test.ts` (round 1; its cases moved into `diff.test.ts`)

## 7. Tests

Kept deliberately small.

| File | Covers |
| --- | --- |
| `src/lib/companies/diff.test.ts` (11) | wire names and `""` clearing; `""` = null; local-only marking; logo filename vs upload; sectors by name + primary; listings by (mic, ticker); field coverage; `applyChanges` round-trip; rebase keeps both sides; conflict detection |
| `src/lib/companies/sync.test.ts` (3) | draft deleted when everything lands; leftover kept exactly; conflict stops before sending |
| `src/lib/api/client.test.ts` (+1) | `apiSend` method, JSON body, Bearer header |
| `src/lib/events/events.test.ts` (rewritten tail) | real event payload; invalid draft not sent; failed save kept locally, cleared on success |

Pre-existing lint errors (not from this session) remain in
`DistributionTab.tsx`, `IdentifiersTab.tsx` and `store/ui.store.ts`.

## 8. Behaviour changes users will notice

- Company editor: **Commit changes** (was "Save changes"); header shows uncommitted
  count; edits survive refresh; no "unsaved changes" prompt on leaving.
- Commit dialog marks local-only changes and can stop on a conflict.
- Opening a company from the list waits for the full API record (one request)
  instead of showing the list row first.
- Companies created in the app get ids from 9,000,001.
- Sheet edits become drafts, committed from the company editor.
- Events: editable, deletable, creatable.

## 9. Open questions (for the API team)

1. **JWT** — how should the admin obtain a token? (Currently `VITE_API_TOKEN`.)
2. **Do industry, listing and social-link writes show up in
   `GET /api/Companies/{id}/full`?** If not, every sector/listing change will be
   reported as unlanded after each commit and kept in the draft, and a retry would
   re-POST listings.
3. **What does `POST /api/Companies` (and `POST /api/Events`) return?** The code
   accepts a bare id or `{ id | companyId | compId | eventId }`.
4. **Which `platform` spelling does `/social-links/{platform}` expect?** Code
   sends `instagram`.

## 10. Not done / next

- The sheet (table) view still has its own model; it was intentionally left out
  beyond saving through drafts. Planned as a separate task.
- Articles remain local-only (no API writes).
- No browser or real-API verification yet — needs a token.
