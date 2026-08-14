# UI Style Reference

Inventory of every field, control and layout style that exists in this codebase today, what each is for, and where it's already used.

**The rule: reuse from this document. Don't invent a new field style.** If something here nearly fits, use it. If nothing fits, add it to `ui.css` in the established idiom and add it here — don't inline styles on a one-off.

Everything lives in two files:

| File | Contains |
|---|---|
| [`src/index.css`](../src/index.css) | Design tokens, font import, element resets |
| [`src/components/ui/ui.css`](../src/components/ui/ui.css) | Every component class (~1,700 lines, one flat sheet) |

There is no CSS-module or styled-component layer. Tailwind is installed and imported but is **not** the working idiom — a handful of stray utility classes exist (`font-semibold`, `text-gray-500` in `CompanyEditor`), and they are the exception, not the pattern. Write plain classes.

---

## 1. Design tokens

All defined on `:root` in `index.css`. Always reference through `var()` — no raw hex in `ui.css`.

### Colour

| Token | Value | Used for |
|---|---|---|
| `--color-text-primary` | `#0a0a0a` | Body text, active states, primary button fill |
| `--color-text-secondary` | `#999999` | Labels, meta text, ghost buttons |
| `--color-text-tertiary` | `#B3B3B3` | Placeholders, disabled, muted values |
| `--color-text-success` | `#2B900A` | Added rows, success toasts |
| `--color-text-danger` | `#DF1B1B` | Errors, delete, removed rows |
| `--color-text-warning` | `#A37301` | Warnings |
| `--color-text-info` | `#2563eb` | Links inside rich text |
| `--color-background-primary` | `#ffffff` | Page, modal, dropdown surfaces |
| `--color-background-secondary` | `#f7f7f7` | Inset fields, hover rows, toolbars |
| `--color-background-hover` | `#f0f0f0` | Button/row hover |
| `--color-background-success` / `-danger` / `-warning` / `-info` | tints | Diff rows, badges, avatars |
| `--color-border-primary` | `#0a0a0a` | Active drop-zone, focused search |
| `--color-border-secondary` | `#d4d4d4` | **Field underlines**, button outlines |
| `--color-border-tertiary` | `#e5e5e5` | Dividers, table rules, panel edges |
| `--color-border-danger` / `-warning` / `-info` / `-success` | tints | Error field underline (only `-danger` is used) |

### Shape, type, layout

| Token | Value | Note |
|---|---|---|
| `--border-radius-sm` | `1px` | Buttons, badges, inset boxes |
| `--border-radius-md` | `3px` | Cards, dropdowns, drop zones, RTE |
| `--border-radius-lg` | `6px` | Modal dialogs only |
| `--font-sans` | Inter | Everything |
| `--font-mono` | SF Mono / Fira Code / Consolas | JSON preview, diff values, codes |
| `--text-xs` `--text-sm` `--text-md` `--text-lg` `--text-xl` `--text-xxl` | 10 / 14 / 16 / 18 / 24 / 32 px | Only `xs` and `sm` are used in practice |
| `--text-spc-neg` | `-0.3px` | Body letter-spacing |
| `--panel-width` | `280px` | Metadata sidebar |
| `--panel-width-article` | `500px` | Press release sidebar — half the working surface, not a strip |
| `--topbar-height` | `48px` | Editor topbar |

> **Caution:** font sizes are frequently hard-coded (`13px`, `12px`, `11.5px`) rather than tokenised. The type scale above is aspirational; match the *neighbouring* component's literal size rather than forcing a token.

---

## 2. Text primitives

`.label` is the workhorse and its bare form is **10px** — that surprises people. The 14px form used above form inputs is `.label.field`.

| Class | Renders | Use for |
|---|---|---|
| `.label` | 10px / 600 | Small caps-ish headers, sidebar section names, dot-row labels |
| `.label.field` | 14px / 600 | **The label above any input.** `<Field>` applies this for you |
| `.label.faded` | + tertiary colour | Secondary key in a key/value row |
| `.label.thin` | weight 500 | De-emphasised label |
| `.label.clickable` | pointer + hover | Inline text actions ("Reset password") |
| `.label.form-title` | 14px + `8px 16px` padding | Title bar inside a `.contact-card` inline form |
| `.label.monospace` | mono 14px / 500 | Codes and IDs |
| `.hint` | 10px / secondary / 1.5 line-height | Helper text under a field or block |
| `.hint.monospace` | mono | Format examples |

---

## 3. Form fields — the catalogue

### 3.1 `<Field>` — the default text input

[`src/components/ui/Field.tsx`](../src/components/ui/Field.tsx). **This is the default for any single-line text input.** Extends all native `<input>` props.

```tsx
<Field
  label="Company Name (EN)"
  defaultValue={draft.name_en}
  placeholder="e.g. Mitsubishi Heavy Industries"
  onChange={e => update({ name_en: e.target.value })}
/>
```

Anatomy: `.field` (column flex, 4px gap) → `.label.field` + `.field__input` + optional `.field__error` / `.hint`.

Visually it is an **underlined input, not a box**: transparent background, no border except `border-bottom: 1px solid var(--color-border-secondary)`, which darkens to primary on focus. Boxed inputs are for the sidebar and toolbars only (§3.5, §3.7).

Props beyond native: `label` (required), `error?`, `hint?`. Passing `error` adds `.field--error`, turning the underline red and rendering the message; `hint` renders only when there is no error.

### 3.2 Select inside a form — `.field__select`

There is no `<Select>` component. Compose it by hand, reusing `.field` and `.label.field` so it lines up with neighbouring `<Field>`s:

```tsx
<div className="field">
  <label className="label field">Contact Type</label>
  <select className="field__select" value={form.contact_type} onChange={...}>
    <option value="freetext">Freetext</option>
  </select>
</div>
```

`.field__select` is styled to match `.field__input` exactly — same underline, padding and focus behaviour. Used in `ContactsTab` (contact type, email format) and `DistributionTab` (status, sector, delivery method). Give it an explicit `style={{ width: 120 }}` when it sits in a row of mixed content.

### 3.3 Multi-line — `.contact-form__textarea`

Same underline treatment, `min-height: 60px`, `resize: none`. Wrap in `.contact-form__notes` (column, 6px gap) with its own `.label.field`. Despite the name it is the general textarea style.

### 3.4 Rich text — `<RichTextEditor>` / `<AboutBlock>`

For prose bodies. `<AboutBlock>` is the higher-level one: view/edit toggle, Edit → Cancel/Save buttons, keeps the editor mounted once opened. Both take a **`variant`**:

| Variant | Toolbar | Use for |
|---|---|---|
| `full` (default) | Headings, B/I/U/S, inline code, text alignment, lists, quote, code block, rule, link, **images**, **tables**, undo/redo, word count | A press release body |
| `basic` | The same minus images and tables | A paragraph of boilerplate (company About, Custom About) |

```tsx
<AboutBlock label="About the company" html={draft.about_html} onChange={html => update({ about_html: html })} variant="basic" />
```

The module is [`src/components/ui/rte/`](../src/components/ui/rte/) — `extensions.ts` (the extension set), `RichTextToolbar.tsx`, `ImageDialog.tsx` — behind the `RichTextEditor.tsx` entry point. Backed by TipTap v3; stores HTML.

Anatomy: `.rte` wraps `.rte__toolbar` (+ `--secondary` for the second row) over an optional `.rte__context-bar`, then `.rte__content` (min-height 120px, line-height 1.7), then `.rte__footer` (word/character count). `.rte__btn` is a toolbar button, `.rte__select` the block-type picker, `.rte__divider` the separator.

Three things to know before changing it:

1. **`useEditor` does not re-render on transactions in v3** (`shouldRerenderOnTransaction` defaults to `false`). Any toolbar state read as `editor.isActive(...)` during render goes stale. Read it through `useEditorState` with a selector instead — the toolbar does.
2. **StarterKit v3 already bundles Link and Underline.** Configure them through `StarterKit.configure({ link: … })`; adding the packages alongside it registers each extension twice.
3. **Image alignment is `data-align`, not `text-align`.** TextAlign writes `text-align` onto the node it targets, and `text-align` on an `<img>` centres nothing. `AlignableImage` adds a `data-align` attribute that CSS turns into auto margins.

**Styling rich content:** every content rule is written against **both** `.rte__content .ProseMirror` and `.about-block__body`. They render the same stored HTML — one editing, one read-only — so a rule applied to only one makes saved content change appearance the moment you stop editing it. Add to both or neither.

Images uploaded through `<ImageDialog>` are inlined as base64 data URLs and capped at 1MB, deliberately tighter than `LogoUpload`'s 3MB: several of them plus the article JSON have to fit inside the ~5MB localStorage quota. Linking by URL is offered first and has no cap.

### 3.5 Boxed select — `.metadata-status-select`

Full-width, padded, bordered, grey fill. **Sidebar only.** Used for Status and Sector in `MetadataPanel`. Reach for this when a select sits in the metadata panel, never in the main canvas.

### 3.6 Read-only value — `.input-box` / `.input-box--row`

A bordered grey box for values you display but don't edit. Add `--row` for space-between layout with a trailing action (e.g. a copy button). Used for portal credentials and the Company ID chip.

### 3.7 Toolbar controls — `.toolbar-select`, `.toolbar-select-btn`, `.companies-search input`

Page-toolbar variants on the list page: underlined select with a custom SVG chevron, an underlined button that opens a dropdown, and a **boxed** 32px search input. `.col-dropdown` + `.col-option` is the dropdown panel they open (see also §7 for the cursor-anchored `ContextMenu`).

### 3.8 Inline search + results — `.wire-search`

The established picker for choosing from a long master list (Reuters/Bloomberg codes, sectors). `.wire-search__input-row` (icon + borderless input) over `.wire-search__results` (max-height 176px, scrolls) of `.wire-search__row`s with `.wire-search__name` / `.wire-search__meta` and a trailing add button. Lives inside a `.contact-card` with a `.label.form-title` header.

### 3.9 File upload — `<DropZone>` / `.drop-zone`

Dashed-border drop target that also opens a file picker on click. `--active` on drag-over, `--filled` switches to a horizontal layout once a file is chosen. `<DropZone accept=".json" onFile={fn}>`.

### 3.10 Toggle — `.toggle` / `.toggle__thumb`

40×22 pill switch, `--on` fills with primary and slides the thumb. Boolean settings only; defined in `DistributionTab` as a local component, not shared — lift it if you need it.

### 3.11 Tri-state dot — `.lang-dot` / `<LanguageDot>`

Click-to-cycle dot with `--active` (green) / `--partial` (black) / `--off` (outline). See [`src/lib/languages.ts`](../src/lib/languages.ts) for the state model and the tooltip/context-menu pattern that documents it.

[`<LanguageDot state>`](../src/components/ui/LanguageDot.tsx) maps a `LanguageState` onto the right modifier. Both metadata panels use it; don't re-derive the class name locally.

### 3.12 Boxed input — `.metadata-input`

The text-input twin of `.metadata-status-select`: full width, padded, bordered, grey fill, border darkens to primary on focus. **Sidebar only** — the canvas uses the underlined `<Field>`. Reach for this whenever a free-text field sits in a metadata panel.

### 3.13 Date and time — `<DateTimeField>`

[`src/components/ui/DateTimeField.tsx`](../src/components/ui/DateTimeField.tsx). Wraps a native `<input type="datetime-local">` styled as `.metadata-input`, so there is a real date control with no new dependency.

```tsx
<DateTimeField label="Date" value={draft.published_at} onChange={iso => update({ published_at: iso })} hint="Local time. Stored as UTC." />
```

The input speaks local wall-clock time; `value` / `onChange` speak ISO. Both conversions live inside the component — callers only ever handle ISO or `null`.

---

## 4. The two data-binding patterns

Both are in use, deliberately. Pick by whether the edit commits immediately.

**A. Uncontrolled + debounced** — for fields that write straight to the draft. `defaultValue`, never `value`, so typing isn't throttled by the 300ms debounce in [`useDebouncedDraft`](../src/hooks/useDebouncedDraft.ts).

```tsx
const update = useDebouncedDraft()
<Field label="Blog" defaultValue={draft.blog ?? ''} onChange={e => update({ blog: e.target.value || null })} />
```

Used by `BasicInfoTab` and `CompanyDetailsTab`. Note the `|| null` idiom: empty string is stored as `null`.

**B. Controlled local form** — for add/edit forms with explicit Save/Cancel. Local `useState`, `value`, commits to the store only on save.

```tsx
const [form, setForm] = useState(initial)
<Field label="Contact name" value={form.name} onChange={e => set('name', e.target.value)} />
```

Used by `ContactsTab`, `IdentifiersTab`, `DistributionTab`. Because pattern A is uncontrolled, the editor remounts the canvas via `key={resetCount}` to flush inputs after a discard.

---

## 5. Layout & grouping

| Class | Purpose |
|---|---|
| `.tab-content` | Root of every tab body |
| `.field-section` | Group of related fields, 24px bottom margin |
| `.section-header__title` | Section heading (see §9 — do **not** use `.section-label`) |
| `.field-row` + `--2` / `--3` | Equal-width grid, **32px** gap |
| `.contact-form__row` + `--3` / `--4` | Same idea inside inline forms, 24px gap |
| `.section-header` + `__title` + `__actions` | Heading with right-aligned buttons above a table |
| `.contact-card` | Bordered container for an inline add/edit form |
| `.contact-form` + `__divider` + `__actions` | Form body, hairline rule, button row |
| `.metadata-panel` + `__section` + `__divider` | 280px right sidebar |
| `.article-panel` + `__title` | 500px right sidebar, press release editor. Same `__section` rows inside |
| `.meta-group` + `__header` / `__chevron` / `__body` | Collapsible section of a panel — see `<CollapsibleGroup>` below |
| `.metadata-field--derived` | Read-only treatment for a computed field: dashes the `.input-box` / `.chip` inside it and greys the text |
| `.translation-row` + `__link` / `__empty` | Language + link (or "Add link +") row |
| `.editor-topbar` / `.editor-body` / `.editor-main` / `.editor-canvas` | Page shell; canvas is the scroll container, 24px padding |
| `.company-editor` / `.article-editor` | Full-height flex column root. One shared rule — add to the selector list rather than copying it |

**`<CollapsibleGroup title meta defaultOpen>`** ([source](../src/components/ui/CollapsibleGroup.tsx)) — the only collapsible section in the codebase. The body **unmounts** when closed, so uncontrolled inputs inside re-read from the draft on the way back in. `meta` is an optional right-aligned `.hint` in the header (a count, a derived value).

Vertical rhythm in a tab: sections 24px apart, rows 24px apart when stacked (`marginTop: 24`), fields 32px apart horizontally. Inline `style` for one-off spacing is common and accepted.

---

## 6. Data display

**`.data-table`** — not a `<table>`; CSS grid rows. `.data-table__header` and `.data-table__row` must share a grid-template class:

```tsx
<div className="data-table">
  <div className="data-table__header identifiers-code-grid"><span>Code</span><span>Description</span><span /></div>
  <div className="data-table__row identifiers-code-grid">…</div>
</div>
```

Existing templates: `.identifiers-listing-grid` (7 cols), `.identifiers-code-grid` (3 cols), `.issuer-grid` (5 cols, sidebar scale), `.sectors-grid`.

`.issuer-grid` + `.issuer-table` is the **sidebar-scale** variant: same `.data-table` bones at 12px with tighter padding, used for the companies on a press release (crown · 16px logo · name · ID · remove). `.company-avatar--xs` is the 16px logo/initials mark. Reach for this shape when a panel needs a real table rather than chips. **Define a new grid class rather than inlining `gridTemplateColumns`.** Cells truncate with ellipsis by default. `.data-table__secondary` greys a cell; `.data-table__delete` / `__edit` are the trailing icon buttons (wrap both in `.data-table__row-actions`); `.data-table__inline-form` is the expanded edit row.

**`.empty-state`** — bordered, centred, 48px padding, for a table with no rows. Every tab currently redefines its own `EmptyState` + inlined SVG; that duplication is a known wart.

**`.chip` / `<Chip>` / `<ChipList>`** ([source](../src/components/ui/Chip.tsx)) — the compact many-to-many display, for when a `.data-table` is too heavy: a short label in a bordered grey pill, with an optional `×`.

```tsx
<ChipList empty="No additional companies.">
  {companies.map(c => <Chip key={c.id} label={c.name_en} onRemove={() => remove(c.id)} />)}
</ChipList>
```

Omit `onRemove` for a read-only chip — that is how derived values render. `<ChipList>` supplies `.chip-list__empty` text when there is nothing to show. Adding is conventionally a `.metadata-status-select` underneath whose first option reads `+ Add …` and which resets itself after each pick.

**`.badge`** — see the warning in §9 before using.

**`.status-dot`** — 8px dot, `--active` green / `--paused` black.

**`.companies-*`** — the **generic list-page shell**, despite the name; treat it the way you treat `commit-*` for modals. `.companies-page` (full-height column) → `.companies-toolbar` (search, filter select, Columns dropdown) → `.companies-table-wrap` (scrolls) → `.companies-table` (the only real `<table>` in the codebase) → `.companies-footer`. `.companies-empty` is the no-rows state. Both the companies list and the press release list at `/article` are built from it — don't fork a second copy for a third list.

Conventions the two share, worth matching in any new list: the first column is the record name at 13px/500 over a `.hint.monospace` identifier, and it cycles name asc → name desc → id on click; secondary text columns use `.sectors-cell` (12px, ellipsised); a missing value is an em dash in `--color-text-tertiary`.

---

## 7. Modals

Every modal reuses the `commit-*` shell, regardless of purpose — the name is historical, treat it as generic:

```tsx
<div className="commit-overlay">            {/* fixed, dark scrim, z-index 200 */}
  <div className="commit-dialog" role="dialog" aria-modal="true">
    <div className="commit-header"><div className="commit-header__text">…</div><button className="commit-close">×</button></div>
    <div className="commit-body">…</div>
    <div className="commit-footer"><div className="commit-footer__actions">…</div></div>
  </div>
</div>
```

Default width 600px; add a sizing class alongside (`.json-import-dialog` and `.annual-report-dialog` are both 480px). Body scrolls at `max-height: 380px`.

Modals mount from `CompanyEditor` keyed off `useUIStore().activeModal`, split into a `*Modal` wrapper (overlay + store wiring) and a `*Dialog` (contents).

**`<ContextMenu>`** ([source](../src/components/ui/ContextMenu.tsx)) — cursor-anchored menu, portalled to `body`, viewport-clamped, closes on outside click / Escape / scroll. Use for right-click state pickers.

---

## 8. Feedback & actions

**Toasts** — `useToastStore().addToast(message, type)` with `info` / `success` / `warning` / `error`. Bottom-right, auto-dismiss, coloured left border.

**`<Button variant size>`** — variants `primary` (black fill) · `outline` · `ghost` · `danger` (red text, grey border) · `warning`; sizes `sm` (12px) · `md` (13px, default).

Established conventions, worth matching:

| Context | Buttons |
|---|---|
| Editor topbar | `ghost` Discard + `primary` Save changes |
| Section header | `outline` `sm` "+ Add …" |
| Inline form footer | `danger` `sm` "✕ Cancel entry" + `outline` `sm` "Save changes" |
| Sidebar full-width | `outline` `sm` with `style={{ width: '100%' }}` |
| Selected-toggle in a list | `primary` when selected, `ghost` when not |

Note `danger` is used for *cancel*, not just destructive actions, and inline forms save with `outline` rather than `primary`. Inconsistent with the topbar, but it is the established pattern — match it.

---

## 9. Known inconsistencies

Verified by auditing `ui.css` against `index.css`. Avoid these; don't copy them into new code.

**Undefined tokens** — these `var()` calls resolve to nothing and silently fall back:

| Token | Referenced by | Effect |
|---|---|---|
| `--color-background` | `.btn--danger` | No background (probably meant `-primary`) |
| `--color-background-tertiary` | `.btn--warning` | No background |
| `--color-background-accent`, `--color-text-accent` | `.avatar-color-4` | Avatar renders unstyled |
| `--border-radius-SM` | `.company-avatar` | Typo for `-sm`; square corners |

**`<Badge>`'s variants still don't exist in CSS.** The component's union is `success | danger | warning | info | neutral`, but `ui.css` defines classes named after *statuses*, not severities. **Any `<Badge variant="success">` renders unstyled.**

What is defined, and works, is the raw `` className={`badge badge--${status}`} `` form both list pages use:

| Defined | For |
|---|---|
| `.badge--active` / `.badge--draft` / `.badge--inactive` | Company status |
| `.badge--published` / `.badge--scheduled` / `.badge--archived` | Press release status (`draft` is shared) |

So a status badge is safe today; `<Badge>` itself is not. Fixing it means aligning the component's union to these status values or adding severity classes — don't reach for `<Badge>` until one of those happens.

**Classes used but never defined:**

| Class | Used by | Effect |
|---|---|---|
| `.section-label` | `CompanyDetailsTab` ×3 — "Company Profile", "Company Links", "Company Address" | No style at all; those headings render as plain 14px body text instead of headings |
| `.sectors-grid` | was on the old sectors table (since removed) | Rows fell back to `.data-table__row`'s default 4-column template while holding 3 cells |

Use `.section-header__title` for a section heading — it is the defined one (14px/600).

**Duplicate declarations** — `.about-block__header` (twice, second wins with different margins), `.drop-zone--active` and `.json-import__drop-zone--active`.

**Near-duplicate components** — `.contacts-header` and `.section-header` are the same thing; prefer `.section-header`.

**Border widths drift** between `1px` and `0.5px` across comparable components. Newer code (list page, modals) tends to `0.5px`.

**Unused tokens** — `--color-border-info/-success/-warning`, `--tabbar-height`, `--text-md/-lg/-xl/-xxl`, `--text-spc-pos`.

---

## 10. Decision table

| I need… | Use |
|---|---|
| Single-line text in a tab | `<Field>` + `useDebouncedDraft` (pattern A) |
| Single-line text in an add/edit form | `<Field>` + local state (pattern B) |
| Dropdown in a tab or form | `.field` + `.label.field` + `.field__select` |
| Dropdown in the sidebar | `.metadata-status-select` |
| Single-line text in the sidebar | `.metadata-input` |
| A date, with or without a time | `<DateTimeField>` |
| Multi-line text | `.contact-form__textarea` |
| Prose / formatted body | `<AboutBlock>` |
| Read-only value | `.input-box` (`--row` with an action) |
| Pick from a long master list | `.wire-search` inside a `.contact-card` |
| File upload | `<DropZone>` |
| Boolean | `.toggle` |
| Two/three fields side by side | `.field-row field-row--2` / `--3` |
| List of records | `.data-table` + a new grid-template class |
| A short many-to-many (tags, related records) | `<ChipList>` + `<Chip>` |
| A value computed from something else | `.metadata-field--derived` around a read-only `.input-box` / chips |
| A panel section that opens and closes | `<CollapsibleGroup>` |
| No records yet | `.empty-state` |
| Heading + action buttons | `.section-header` |
| Dialog | `commit-overlay` / `commit-dialog` shell |
| Right-click menu | `<ContextMenu>` |
| Transient confirmation | `addToast(...)` |

---

## 11. Gaps — nothing exists for these yet

Each needs a new style built in the idiom above, not an ad-hoc one:

- **Headline-scale text input** — the largest input is 14px. The press release headline field probably wants more presence; `h1` is 20px/400. Currently a plain `<Field>`.
- **Character counter** — exists inside the RTE footer only (`.rte__footer`, from TipTap's CharacterCount). There is still nothing for a plain `<Field>`.
- **Embargo** — `<DateTimeField>` covers "publish at", but there is still no embargo/until pairing and no timezone display: the control shows local time and stores UTC with no label saying so beyond a `hint`.
- **Working `<Badge>` variants** — see §9. The status *classes* now cover both record types; the `<Badge>` component's severity union is still unbacked.
- **Shared `EmptyState`** — currently copy-pasted per tab with an inlined 3KB SVG. `.chip-list__empty` covers the one-line case only.
Closed since the last revision, by the press release editor:

| Was a gap | Now |
|---|---|
| Date / time input | `<DateTimeField>` (§3.13) |
| Multi-select / chips | `<Chip>` / `<ChipList>` (§6) |
| Collapsible sections | `<CollapsibleGroup>` (§5) |
| Boxed sidebar text input | `.metadata-input` (§3.12) |
| Inline images in rich text | `<ImageDialog>` + `AlignableImage` (§3.4) |
| Tables in rich text | TipTap `TableKit`, with a contextual table bar (§3.4) |
