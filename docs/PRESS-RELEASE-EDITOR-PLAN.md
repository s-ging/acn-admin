# Press Release Editor — Build Plan

Status: **built.** §10 has since been answered, and *not* the way the default assumed — see that section. Implementation notes in §3.

Scope: a functional scaffold for the press release editor at `/article/{id}`. Not a finished product — but every decision here is made so the scaffold doesn't have to be unpicked later.

Companion document: [UI Style Reference](./UI-STYLE-REFERENCE.md). Every style decision below traces back to it — **reuse first, add only what genuinely doesn't exist.**

---

## 1. Guiding change

Sector and Industry stop being things a person picks. They are **derived from the companies responsible for the release**. The company selection is promoted to the top of the sidebar; classification demotes to a read-only consequence of it.

Order of the sidebar's first group is therefore: **Date · Status · Company**. Everything else populates from there.

Two reasons this is worth the wiring:

1. The taxonomy can't drift from reality — a release about Toyota can't be mis-filed under Healthcare.
2. It removes two judgement calls from whoever files the release.

It also sets up a later win: once a release knows its sector, [`lib/sector-routing.ts`](../src/lib/sector-routing.ts) can hand it Reuters and Bloomberg codes with no extra input. Out of scope here, but the reason the derivation is worth doing properly.

---

## 2. Interface inventory

### Canvas (left)

Breadcrumb → "Create Press Release" title with two read-only chips (Primary issuer, Article ID) → Headline | Subheadline side by side → Summary full width → **Dateline** → Main Content (rich text) → Custom About (rich text).

**The Dateline is not a field.** It is the opening of `body_html` — the way the wires and NewsML treat it — and the box on the canvas parses and rewrites that text rather than storing a second copy. See [`lib/press-releases/dateline.ts`](../src/lib/press-releases/dateline.ts); the recognition rule documented there is the thing to confirm with the desk.

**It composes itself.** Location + Date give `Tokyo, Japan` + `2020-08-14` → `TOKYO, August 14, 2020`, recomposed whenever either changes. Typing your own takes it off the automatic one — `dateline_overridden`, the same escape hatch `classification_overridden` gives Sector — and a "Use location" link puts it back.

Two things keep this from ever eating someone's copy:

- Only the opening of the *first* paragraph is ever rewritten.
- Records written before the flag existed are marked overridden on load **if they already have a dateline**. Auto-fill therefore only applies to releases with nothing to lose.

### Sidebar (right)

A "Metadata" title, then six collapsible groups. **~500px wide — nearly double the company editor's `--panel-width: 280px`.** That is a structural difference, not a detail: the company sidebar is a strip of metadata, this one is half the working surface.

Save and Discard live in the **editor topbar**, alongside the breadcrumb, exactly as they do in the company editor — one place to save, whichever half you were working in.

### The control-style split

The design already honours the split documented in the style reference, so nothing needs inventing:

| Region | Control style | Existing class |
|---|---|---|
| Canvas | Underlined, transparent | `<Field>` / `.field__input` |
| Sidebar | Boxed, grey fill | `.metadata-status-select` |

---

## 3. The derivation rule

Company records already carry the right shape:

```
company.sectors[0] = { sector_type: "Industrial", sector_name: "Automotive" }
                       ─────┬──────                ─────┬──────
                        the category               the specific
```

Which maps onto the two sidebar fields exactly:

| Sidebar field | Derived from | Cardinality |
|---|---|---|
| **Sector** (single select) | `sector_type` of the **primary issuer** | one |
| **Industry** (chips) | `sector_name` of **every** company on the release, deduped | many |

Worked example — Toyota (Automotive) + Honda (Automotive) + Mitsubishi Heavy (Manufacturing), Toyota the issuer:

> Sector: `Industrial` · Industry: `Automotive`, `Manufacturing`

### Edge cases — decided, because an ambiguous rule is worthless

| Case | Rule |
|---|---|
| Companies span different categories (Toyota = Industrial, Datavault = Technology) | Sector follows the **primary issuer only** — "the sector is whoever's release this is". Industry still collects from all. |
| A selected company has no sector | Contributes nothing. Fields go empty with a hint. Never guess. |
| The editor disagrees with the derivation | `classification_overridden: boolean`. `false` (default) = read-only, recomputes whenever companies change. `true` = unlocked for manual edit, recomputation stops. |

That override flag is two lines now and a data migration later. Without it the scaffold dead-ends the first time someone needs an exception.

### Implementation shape

`lib/press-releases/derive.ts` — a **pure function**, same pattern as `applySectorRouting`: takes companies plus current classification, returns a patch. Called from the update path, unit-tested exhaustively before any UI hangs off it.

### Implementation note — resolve through the taxonomy, not the stored strings

Found while building. A company's `sector_type` / `sector_name` are a denormalised copy that predates the current taxonomy and **can be stale**: seeded records carry `Industry` where [`lib/sectors.ts`](../src/lib/sectors.ts) says `Industrial`, and `Finance` where it says `Financial`. Deriving straight from the stored string would have filed Toyota under `Industry`, not the `Industrial` in the worked example above.

So `resolveSector()` looks the company's `sector_id` up in the master list and takes the taxonomy's spelling, falling back to the stored strings only for a sector the list doesn't know. The rule in §3 is unchanged — this is just where it reads the words from.

The single update path lives in `ArticleMetadataPanel`: every group patches the draft through one `update()` that runs the derivation, so no control can change the company selection without the classification following.

The company-list rules themselves — no duplicates, and a primary issuer that is always a company actually on the release — live in [`lib/press-releases/companies.ts`](../src/lib/press-releases/companies.ts) as pure patch-returning functions, so the UI never hand-rolls them.

---

## 4. Sidebar group order

| # | Group | Fields |
|---|---|---|
| 1 | **Publication** | Date · Status · **Companies** (the whole list, one crowned as primary issuer) |
| 2 | **Classification** *(derived, demoted)* | Sector · Industry chips · Topic · Languages |
| 3 | **Location** | Region · Location |
| 4 | **Relations** | Supplier · Contacts · Translations |
| 5 | **Distribution** | Article Type · Tracking ID · Distribute to · Source |
| 6 | **Workflow** | Report By · Send By |

Changes from the mockup: **Status** moves up out of Workflow into group 1. **Sector / Industry** drop into a quieter read-only treatment. Group 1 is what you touch; group 2 is what results.

There is only one company control, and it is in group 1 — see §10. Relations keeps the people and the links.

Language (EN/JA dots) stays in Classification to match the mockup, though it overlaps conceptually with Translations in group 4. Worth collapsing later — not in the scaffold.

---

## 5. Data model

`src/types/press-release.types.ts` — `PressRelease`:

| Area | Fields |
|---|---|
| Identity | `id`, `article_id`, `company_ids[]`, `primary_issuer_id` |
| Content | `headline`, `subheadline`, `summary`, `body_html`, `dateline_overridden`, `custom_about_html` |
| Publication | `published_at` (ISO), `status` |
| Classification | `sector_type`, `industries[]`, `topic`, `classification_overridden`, `languages` / `secondary_languages` |
| Location | `region`, `location` |
| Relations | `supplier`, `contacts[]`, `translations[]` |
| Distribution | `article_type`, `tracking_id`, `distribute_to`, `source` |
| Workflow | `report_by`, `send_by` |
| Audit | `created_at`, `updated_at` |

Language reuses the existing `LanguageTags` shape from [`lib/languages.ts`](../src/lib/languages.ts) and the `.lang-dot` control verbatim — same three-state model, same tooltip and right-click menu.

---

## 6. Routing & persistence

| Route | Behaviour |
|---|---|
| `/article/:id` | The editor |
| `/article/new` | Generates the next id, writes a blank record, redirects to `/article/:id` |

Mirrors what the companies list already does. Persistence is localStorage under `acn_article_{id}`, matching `acn_company_{id}`.

**Every read goes through `normalizeArticle()` from day one.** That is the direct lesson from the `secondary_languages` crash: records are cast from JSON, so any field added later is `undefined` at runtime on older records. One normalisation choke point, present before there's any legacy data to fix.

`store/article.store.ts` mirrors `store/company.store.ts`: `original` / `draft` / `updateDraft` / `resetDraft` / `commitSuccess`. Save writes to localStorage and raises a toast.

---

## 7. Files

```
types/press-release.types.ts
lib/press-releases/derive.ts            + derive.test.ts
lib/press-releases/normalize.ts
lib/press-releases/mock.ts              (2–3 seeded articles)
store/article.store.ts
pages/articles/ArticleEditorPage.tsx
components/article/ArticleEditor.tsx
components/article/canvas/ArticleCanvas.tsx
components/article/panels/ArticleMetadataPanel.tsx
components/article/panels/groups/PublicationGroup.tsx
                                /ClassificationGroup.tsx
                                /LocationGroup.tsx
                                /RelationsGroup.tsx
                                /DistributionGroup.tsx
                                /WorkflowGroup.tsx
components/ui/CollapsibleGroup.tsx
components/ui/Chip.tsx
components/ui/DateTimeField.tsx
```

Plus one route in `App.tsx` and one block appended to `ui.css`.

---

## 8. Styling

### Reused unchanged

`<Field>` for all canvas text · `.field-row--2` for headline/subheadline · `<AboutBlock>` / `RichTextEditor` for both rich-text blocks · `.input-box--row` for the canvas Company and Article-ID chips · `.metadata-status-select` for all sidebar selects · `.lang-dot` for Language · `.contact-card` for sidebar contacts · `.label` / `.hint` / `<Button>` / toasts.

### New — seven additions, built in the existing idiom

| Class / component | Why nothing existing fits |
|---|---|
| `.meta-group` + `__header` / `__chevron` / `__body` | No collapsible section exists anywhere |
| `.chip` / `.chip-list` / `.chip__remove` | Documented gap — every many-to-many is a `.data-table` today |
| `.metadata-input` | Boxed sidebar **input**; only the boxed *select* exists |
| `.metadata-field--derived` | Read-only / locked treatment for Sector and Industry |
| `--panel-width-article: 500px` | Sidebar is ~2× the company panel |
| `.issuer-grid` / `.issuer-table` | `.data-table` at sidebar scale, for the company list |
| `.translation-row` | EN active / JA "Add link +" row |

`DateTimeField` wraps a native `<input type="datetime-local">` styled to match `.metadata-status-select` — closes the documented date gap with no new dependency.

Anything added here gets appended to the style reference in the same pass.

---

## 9. Out of scope for the scaffold

Move any of these in if wanted:

- ~~**Press-release list page**~~ — **built after all**, at `/article`, from the same `.companies-*` shell the companies list uses. That meant the `<Badge>` blocker below had to be dealt with rather than sidestepped: `.badge--published` / `--scheduled` / `--archived` are now defined (`draft` was already), so status renders correctly in the table
- **Diff / commit modal** — a whole subsystem; save writes directly
- ~~**Image upload in the body**~~ — **built after all**, along with tables and alignment. The RTE became a module under [`components/ui/rte/`](../src/components/ui/rte/) with a `full` / `basic` variant split; see [style reference §3.4](./UI-STYLE-REFERENCE.md). Uploaded images are inlined as base64 and capped at 1MB, and `saveArticle` now reports a quota failure instead of throwing
- **Wire-code routing** from the derived sector
- **Topbar search**, **left icon rail**

Resolved blocker: `<Badge>`'s severity variants still don't exist in CSS ([style reference §9](./UI-STYLE-REFERENCE.md)), but the raw `badge badge--{status}` form now has a class for every press release status, which is what the list page uses. The editor sidebar renders status as a select regardless.

---

## 10. Open question — resolved by default

The mockup showed **two** company concepts: a singular `Company: Datavault AI` chip on the canvas, and a plural `Companies: TOYOTA, Mitsubishi Heavy Industries, Honda` list in Relations. The original build assumed a primary company plus a bag of lesser "additional" ones.

**Answered: neither tier nor flat, but flat with a crown.**

> Every company on a release carries **equal weight**. There is no second class:
> each one is credited and each one contributes its sector to Industry.
>
> Exactly one of them is the **primary issuer** — whose release this ultimately
> is. That one, and only that one, sets the Sector, and it is the company named
> on the canvas.

So precedence is a **flag, not a position**: the issuer can sit anywhere in the list, and re-sorting the table never changes who it is.

| Was | Now |
|---|---|
| `company_id` + `related_company_ids[]` | `company_ids[]` + `primary_issuer_id` |
| Two controls: one in Publication, one in Relations | One table in Publication |
| Sector from the primary company | Sector from the primary issuer |

Rules, in [`lib/press-releases/companies.ts`](../src/lib/press-releases/companies.ts):

- `company_ids` holds no duplicates.
- `primary_issuer_id` is null or a member of `company_ids` — never a company that isn't on the release.
- The first company added becomes the issuer.
- **Removing the issuer promotes the first company still on the release**, so the Sector keeps deriving. A release with companies but no issuer can derive nothing, which is a worse state than picking the obvious one.

Old records migrate on read through `normalizeArticle` — the old singular company was by definition the one that took precedence, so it becomes the issuer and keeps its place at the head of the list. That is what the choke point in §6 was for.

---

## 11. Build order

1. `press-release.types.ts` — the model
2. `derive.ts` + tests — **the rule, locked and proven before any UI depends on it**
3. `normalize.ts`, `mock.ts`, `article.store.ts` — data layer
4. CSS additions — the seven new styles
5. Editor shell, route, canvas
6. Sidebar groups, in the order in §4
7. Update the style reference with whatever was added
