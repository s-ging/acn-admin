# Press Release Editor — Build Plan

Status: **agreed, not yet built.** One open question in §10.

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

Breadcrumb → "Create Press Release" title with two read-only chips (Company, Article ID) → Headline | Subheadline side by side → Summary full width → Main Content (rich text) → Custom About (rich text).

### Sidebar (right)

Its own "Save changes" header, then six collapsible groups. **~500px wide — nearly double the company editor's `--panel-width: 280px`.** That is a structural difference, not a detail: the company sidebar is a strip of metadata, this one is half the working surface.

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
| **Sector** (single select) | `sector_type` of the **primary** company | one |
| **Industry** (chips) | `sector_name` of **every** selected company, deduped | many |

Worked example — Toyota (Automotive) + Honda (Automotive) + Mitsubishi Heavy (Manufacturing):

> Sector: `Industrial` · Industry: `Automotive`, `Manufacturing`

### Edge cases — decided, because an ambiguous rule is worthless

| Case | Rule |
|---|---|
| Companies span different categories (Toyota = Industrial, Datavault = Technology) | Sector follows the **primary company only** — "the sector is whoever's release this is". Industry still collects from all. |
| A selected company has no sector | Contributes nothing. Fields go empty with a hint. Never guess. |
| The editor disagrees with the derivation | `classification_overridden: boolean`. `false` (default) = read-only, recomputes whenever companies change. `true` = unlocked for manual edit, recomputation stops. |

That override flag is two lines now and a data migration later. Without it the scaffold dead-ends the first time someone needs an exception.

### Implementation shape

`lib/press-releases/derive.ts` — a **pure function**, same pattern as `applySectorRouting`: takes companies plus current classification, returns a patch. Called from the update path, unit-tested exhaustively before any UI hangs off it.

---

## 4. Sidebar group order

| # | Group | Fields |
|---|---|---|
| 1 | **Publication** | Date · Status · **Company** (primary) |
| 2 | **Classification** *(derived, demoted)* | Sector · Industry chips · Topic |
| 3 | **Location** | Region · Location |
| 4 | **Relations** | Supplier · Companies (additional) · Contacts · Translations |
| 5 | **Distribution** | Article Type · Tracking ID · Distribute to · Source |
| 6 | **Workflow** | Report By · Send By |

Changes from the mockup: **Status** moves up out of Workflow into group 1. **Sector / Industry** drop into a quieter read-only treatment. Group 1 is what you touch; group 2 is what results.

Language (EN/JA dots) stays in Classification to match the mockup, though it overlaps conceptually with Translations in group 4. Worth collapsing later — not in the scaffold.

---

## 5. Data model

`src/types/press-release.types.ts` — `PressRelease`:

| Area | Fields |
|---|---|
| Identity | `id`, `company_id` (primary), `article_id` |
| Content | `headline`, `subheadline`, `summary`, `body_html`, `custom_about_html` |
| Publication | `published_at` (ISO), `status` |
| Classification | `sector_type`, `industries[]`, `topic`, `classification_overridden`, `languages` / `secondary_languages` |
| Location | `region`, `location` |
| Relations | `supplier`, `related_company_ids[]`, `contacts[]`, `translations[]` |
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
| `.panel-topbar` | "Save changes" header inside the panel |
| `.translation-row` | EN active / JA "Add link +" row |

`DateTimeField` wraps a native `<input type="datetime-local">` styled to match `.metadata-status-select` — closes the documented date gap with no new dependency.

Anything added here gets appended to the style reference in the same pass.

---

## 9. Out of scope for the scaffold

Move any of these in if wanted:

- **Press-release list page** — the breadcrumb implies one; would be stubbed
- **Diff / commit modal** — a whole subsystem; save writes directly
- **Image upload in the body** — the RTE runs StarterKit + link + underline only. **No image extension is installed**, so the inline image in the mockup needs a new TipTap extension, not just styling
- **Wire-code routing** from the derived sector
- **Topbar search**, **left icon rail**

Known blocker for a future list page: `<Badge>`'s variants don't exist in CSS ([style reference §9](./UI-STYLE-REFERENCE.md)). Status renders as a select here, so the scaffold sidesteps it.

---

## 10. Open question

The mockup shows **two** company concepts: a singular `Company: Datavault AI` chip on the canvas, and a plural `Companies: TOYOTA, Mitsubishi Heavy Industries, Honda` list in Relations.

This plan assumes:

> **primary company** — group 1, drives Sector, appears in the canvas chip
> **additional companies** — Relations, contribute Industry chips only

If instead there is one flat list of co-responsible companies with no primary, the Sector rule needs a different tie-breaker (most common category, or first added). Everything else in this plan is unaffected.

**Default if unanswered:** build primary + additional, because it makes the derivation deterministic.

---

## 11. Build order

1. `press-release.types.ts` — the model
2. `derive.ts` + tests — **the rule, locked and proven before any UI depends on it**
3. `normalize.ts`, `mock.ts`, `article.store.ts` — data layer
4. CSS additions — the seven new styles
5. Editor shell, route, canvas
6. Sidebar groups, in the order in §4
7. Update the style reference with whatever was added
