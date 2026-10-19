// src/lib/companies/diff.ts
// The one diff for companies: what differs between the API version (the base)
// and the local draft.
//
// Every change it produces carries three things, so that nothing downstream has
// to diff again:
//
//   display — what the commit dialog shows (label, old → new, section)
//   patch   — how to apply the change to another copy of the record. This is
//             what lets a draft be rebased onto a fresher API version, and lets
//             a commit keep only what did not land.
//   ops     — the wire requests that send it, or none. A change with no request
//             is `sync: 'local'` and says why: the API has no endpoint for it.
//
// Fields are listed once, in FIELDS, with where each one goes on the wire.
// Collections are listed once, in COLLECTIONS, with the key that identifies an
// item. A field added to CompanyFull and not listed in either is caught by a
// test (see diff.test.ts), so the diff cannot silently go blind to it.

import { LANGUAGES, LANGUAGE_STATE_INFO, getLanguageState, setLanguageState } from '../languages'
import type { LanguageState } from '../languages'
import type { ApiCompanyBasicInfo, ApiCompanyDetailsWrite } from '../api/types'
import type {
  Change,
  ChangeSection,
  CompanyFull,
  LanguageCode,
} from '../../types/company.types'

// ── What a change carries ───────────────────────────────────────────────────

export type CollectionName =
  | 'sectors'
  | 'exchange_listings'
  | 'contacts'
  | 'wire_codes'
  | 'rss_feeds'
  | 'relations'
  | 'wire_services'

export type Patch =
  | { kind: 'set'; path: string; value: unknown }
  | { kind: 'language'; code: LanguageCode; state: LanguageState }
  | { kind: 'upsert'; collection: CollectionName; key: string; item: unknown }
  | { kind: 'remove'; collection: CollectionName; key: string }
  | { kind: 'order'; collection: CollectionName; keys: string[] }

/**
 * One request's worth of work. Field ops are merged into a single
 * `PUT /api/Companies/{id}` by lib/api/write.ts; the rest are one request each.
 * A cleared field travels as "" — on the update DTOs, null means "leave it".
 */
export type WireOp =
  | { kind: 'basicInfo'; key: keyof ApiCompanyBasicInfo; value: string }
  | { kind: 'details'; key: keyof ApiCompanyDetailsWrite; value: string }
  | { kind: 'social:put'; platform: string; url: string }
  | { kind: 'social:delete'; platform: string }
  | { kind: 'industry:put'; name: string; isPrimary: boolean }
  | { kind: 'industry:delete'; name: string; fallbackId: number }
  | { kind: 'listing:create'; mic: string; ticker: string; isPrimary: boolean; sortOrder: number }
  | { kind: 'listing:update'; mic: string; ticker: string; isPrimary: boolean; sortOrder: number }
  | { kind: 'listing:delete'; mic: string; ticker: string }

export type CompanyChange = Change & { patch: Patch; ops: WireOp[] }

// ── Values ──────────────────────────────────────────────────────────────────

function get(record: CompanyFull, path: string): unknown {
  return path.split('.').reduce<unknown>((at, part) => (at as Record<string, unknown> | null)?.[part], record)
}

/** The API sends "" as freely as null, and an emptied input gives "". Same thing. */
function blankToNull(value: unknown): unknown {
  return value === '' || value === undefined ? null : value
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(blankToNull(a)) === JSON.stringify(blankToNull(b))

/**
 * The stored filename behind an absolute URL — the read model carries URLs, the
 * wire stores bare names. Undefined for a `data:` URI (an in-browser upload
 * preview): there is no file on the server and no endpoint to put one there.
 */
function filename(url: unknown): string | null | undefined {
  if (url === null || url === '' || url === undefined) return null
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return undefined
  return decodeURIComponent(url.split('?')[0].split('/').pop() ?? '') || null
}

/** The annual-report text fields describe a file. If that file is a local upload, they can't be sent. */
const reportIsUpload = (c: CompanyFull) => !!c.annual_report_url?.startsWith('data:')

// ── Fields ──────────────────────────────────────────────────────────────────

type FieldWire =
  | { to: 'basicInfo'; key: keyof ApiCompanyBasicInfo; encode?: (value: unknown, draft: CompanyFull) => string | null | undefined }
  | { to: 'details'; key: keyof ApiCompanyDetailsWrite }
  | { to: 'social'; platform: string }
  | { to: 'local'; reason: string }

interface FieldDef {
  path: string
  label: string
  section: ChangeSection
  wire: FieldWire
}

const NO_ENDPOINT = 'The API has no field for this.'

const reportField = (key: keyof ApiCompanyBasicInfo): FieldWire => ({
  to: 'basicInfo',
  key,
  encode: (value, draft) => (reportIsUpload(draft) ? undefined : (value as string | null)),
})

export const FIELDS: FieldDef[] = [
  { path: 'name_en',      label: 'Company name (EN)',      section: 'basic-info', wire: { to: 'basicInfo', key: 'companyNameEN' } },
  { path: 'name_zh_hans', label: 'Company name (ZH-HANS)', section: 'basic-info', wire: { to: 'basicInfo', key: 'companyNameCH' } },
  { path: 'name_zh_hant', label: 'Company name (ZH-HANT)', section: 'basic-info', wire: { to: 'basicInfo', key: 'companyNameCT' } },
  { path: 'name_ja',      label: 'Company name (JA)',      section: 'basic-info', wire: { to: 'basicInfo', key: 'companyNameJP' } },
  { path: 'name_ko',      label: 'Company name (KO)',      section: 'basic-info', wire: { to: 'basicInfo', key: 'companyNameKO' } },
  { path: 'status',       label: 'Status',                 section: 'basic-info', wire: { to: 'local', reason: NO_ENDPOINT } },
  { path: 'url',          label: 'Homepage',               section: 'basic-info', wire: { to: 'basicInfo', key: 'url' } },
  { path: 'about_html',   label: 'About / Boilerplate',    section: 'basic-info', wire: { to: 'basicInfo', key: 'boilerPlate' } },
  { path: 'logo_article_url', label: 'Article page logo',  section: 'basic-info', wire: { to: 'basicInfo', key: 'logoFilename', encode: filename } },
  { path: 'logo_top_url',     label: 'Top page logo',      section: 'basic-info', wire: { to: 'basicInfo', key: 'topLogoFilename', encode: filename } },
  { path: 'annual_report_name', label: 'Annual report',      section: 'basic-info', wire: reportField('reportFilename') },
  { path: 'annual_report_date', label: 'Annual report date', section: 'basic-info', wire: reportField('reportFileDate') },
  { path: 'annual_report_size', label: 'Annual report size', section: 'basic-info', wire: reportField('reportFileSize') },
  { path: 'annual_report_url',  label: 'Annual report file', section: 'basic-info', wire: { to: 'local', reason: 'The API has no file upload endpoint.' } },

  // Six of the seven social links are columns on the details DTO, and that is
  // what /full reads back. Instagram has no column, so it uses /social-links.
  { path: 'blog',      label: 'Blog',        section: 'basic-info', wire: { to: 'details', key: 'blog' } },
  { path: 'linkedin',  label: 'LinkedIn',    section: 'basic-info', wire: { to: 'details', key: 'linkedIn' } },
  { path: 'twitter',   label: 'Twitter / X', section: 'basic-info', wire: { to: 'details', key: 'twitter' } },
  { path: 'facebook',  label: 'Facebook',    section: 'basic-info', wire: { to: 'details', key: 'facebook' } },
  { path: 'youtube',   label: 'YouTube',     section: 'basic-info', wire: { to: 'details', key: 'youTube' } },
  { path: 'telegram',  label: 'Telegram',    section: 'basic-info', wire: { to: 'details', key: 'telegram' } },
  { path: 'instagram', label: 'Instagram',   section: 'basic-info', wire: { to: 'social', platform: 'instagram' } },

  { path: 'telephone',            label: 'Telephone',          section: 'company-details', wire: { to: 'details', key: 'telephone' } },
  { path: 'facsimile',            label: 'Fax',                section: 'company-details', wire: { to: 'details', key: 'facsimile' } },
  { path: 'company_email',        label: 'Company email',      section: 'company-details', wire: { to: 'details', key: 'email' } },
  // addr1..addr4 are street, district, city, country — as on the read side.
  { path: 'address_street',       label: 'Address',            section: 'company-details', wire: { to: 'details', key: 'addr1' } },
  { path: 'address_district',     label: 'District',           section: 'company-details', wire: { to: 'details', key: 'addr2' } },
  { path: 'address_city',         label: 'City',               section: 'company-details', wire: { to: 'details', key: 'addr3' } },
  { path: 'address_country',      label: 'Country',            section: 'company-details', wire: { to: 'details', key: 'addr4' } },
  { path: 'established',          label: 'Established',        section: 'company-details', wire: { to: 'details', key: 'established' } },
  { path: 'exchange_listed_date', label: 'Listed',             section: 'company-details', wire: { to: 'details', key: 'listed' } },
  { path: 'employees',            label: 'Employees',          section: 'company-details', wire: { to: 'details', key: 'employees' } },
  { path: 'duns_number',          label: 'DUNS number',        section: 'company-details', wire: { to: 'details', key: 'dunsNumber' } },
  { path: 'otc',                  label: 'OTC',                section: 'company-details', wire: { to: 'details', key: 'otc' } },
  { path: 'market_id',            label: 'Market ID',          section: 'company-details', wire: { to: 'details', key: 'marketId' } },
  { path: 'url_ja',               label: 'Japanese homepage',  section: 'company-details', wire: { to: 'details', key: 'urlJa' } },
  { path: 'key_person_1_name',    label: 'Key person 1',       section: 'company-details', wire: { to: 'details', key: 'pos1Name' } },
  { path: 'key_person_1_title',   label: 'Key person 1 title', section: 'company-details', wire: { to: 'details', key: 'pos1Desc' } },
  { path: 'key_person_2_name',    label: 'Key person 2',       section: 'company-details', wire: { to: 'details', key: 'pos2Name' } },
  { path: 'key_person_2_title',   label: 'Key person 2 title', section: 'company-details', wire: { to: 'details', key: 'pos2Desc' } },

  { path: 'portal_username', label: 'Portal username', section: 'distribution', wire: { to: 'local', reason: NO_ENDPOINT } },
  { path: 'portal_password', label: 'Portal password', section: 'distribution', wire: { to: 'local', reason: NO_ENDPOINT } },
  { path: 'delivery_settings.allow_access',              label: 'Allow access',              section: 'distribution', wire: { to: 'local', reason: NO_ENDPOINT } },
  { path: 'delivery_settings.show_photos',               label: 'Show photos',               section: 'distribution', wire: { to: 'local', reason: NO_ENDPOINT } },
  { path: 'delivery_settings.show_banner',               label: 'Show banner',               section: 'distribution', wire: { to: 'local', reason: NO_ENDPOINT } },
  { path: 'delivery_settings.company_will_mail',         label: 'Company will mail',         section: 'distribution', wire: { to: 'local', reason: NO_ENDPOINT } },
  { path: 'delivery_settings.show_extended_boilerplate', label: 'Show extended boilerplate', section: 'distribution', wire: { to: 'local', reason: NO_ENDPOINT } },
  { path: 'delivery_settings.show_archives',             label: 'Show archives',             section: 'distribution', wire: { to: 'local', reason: NO_ENDPOINT } },
  { path: 'delivery_settings.show_alerts',               label: 'Show alerts',               section: 'distribution', wire: { to: 'local', reason: NO_ENDPOINT } },
  { path: 'delivery_settings.delivery_method',           label: 'Delivery method',           section: 'distribution', wire: { to: 'local', reason: NO_ENDPOINT } },
]

/**
 * Fields the diff deliberately does not look at: identity, audit stamps the API
 * never supplies, and state derived from another field.
 */
export const IGNORED_FIELDS = new Set([
  'id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'updated_by_name',
  // Derived from about_html by the editor; about_html is what is compared.
  'about_prosemirror',
  // Compared per language, below.
  'languages', 'secondary_languages',
])

function fieldChange(def: FieldDef, base: CompanyFull, draft: CompanyFull): CompanyChange | null {
  const before = get(base, def.path)
  const after = get(draft, def.path)
  if (same(before, after)) return null

  const display = {
    type: 'edit' as const,
    key: `field:${def.path}`,
    section: def.section,
    field: def.path,
    label: def.label,
    old_value: before,
    new_value: after,
    patch: { kind: 'set' as const, path: def.path, value: after },
  }
  const local = (reason: string): CompanyChange => ({ ...display, sync: 'local', reason, ops: [] })

  const wire = def.wire
  switch (wire.to) {
    case 'local':
      return local(wire.reason)
    case 'basicInfo': {
      const value = wire.encode ? wire.encode(after, draft) : (blankToNull(after) as string | null)
      if (value === undefined) return local('A locally uploaded file — the API has no upload endpoint.')
      return { ...display, sync: 'api', ops: [{ kind: 'basicInfo', key: wire.key, value: value ?? '' }] }
    }
    case 'details':
      return { ...display, sync: 'api', ops: [{ kind: 'details', key: wire.key, value: (blankToNull(after) as string | null) ?? '' }] }
    case 'social': {
      const url = (blankToNull(after) as string | null)?.trim()
      return {
        ...display,
        sync: 'api',
        ops: [url ? { kind: 'social:put', platform: wire.platform, url } : { kind: 'social:delete', platform: wire.platform }],
      }
    }
  }
}

// ── Languages ───────────────────────────────────────────────────────────────

/**
 * Compared by state per language rather than by list membership, so a language
 * moving between main and secondary reads as one change. Local: the API has no
 * language field.
 */
function languageChanges(base: CompanyFull, draft: CompanyFull): CompanyChange[] {
  const changes: CompanyChange[] = []
  for (const { code } of LANGUAGES) {
    const before = getLanguageState(base, code)
    const after = getLanguageState(draft, code)
    if (before === after) continue

    const common = {
      key: `language:${code}`,
      section: 'basic-info' as const,
      sync: 'local' as const,
      reason: NO_ENDPOINT,
      patch: { kind: 'language' as const, code, state: after },
      ops: [],
    }
    if (before === 'none' || after === 'none') {
      changes.push({
        ...common,
        type: before === 'none' ? 'add' : 'remove',
        entity: 'Language',
        label: code,
        detail: LANGUAGE_STATE_INFO[before === 'none' ? after : before].label,
      })
    } else {
      changes.push({
        ...common,
        type: 'edit',
        field: `language:${code}`,
        label: `Language ${code}`,
        old_value: LANGUAGE_STATE_INFO[before].label,
        new_value: LANGUAGE_STATE_INFO[after].label,
      })
    }
  }
  return changes
}

// ── Collections ─────────────────────────────────────────────────────────────

interface CollectionDef<T> {
  section: ChangeSection
  entity: string
  /** What makes two items the same item. For the API-backed ones, how the API addresses it. */
  key: (item: T) => string
  label: (item: T) => string
  detail: (item: T) => string | null
  /** Whether order matters (the first is primary). */
  ordered: boolean
  /** Null when the API can store this collection; otherwise why it can't. */
  localReason: string | null
  /** Items the API could never accept — skipped when building requests. */
  sendable?: (item: T) => boolean
}

type ItemOf<K extends CollectionName> = CompanyFull[K][number]

const COLLECTIONS: { [K in CollectionName]: CollectionDef<ItemOf<K>> } = {
  // By NAME, not sector_id: a sector picked in the editor carries a
  // lib/sectors.ts id, which is not the wire's id space (AC-M1, map-company.ts).
  sectors: {
    section: 'basic-info', entity: 'Sector',
    key: s => s.sector_name.trim().toLowerCase(),
    label: s => s.sector_name, detail: s => s.sector_type || null,
    ordered: true, localReason: null,
  },
  // By (mic, ticker) — how the listings endpoints address a row.
  exchange_listings: {
    section: 'identifiers', entity: 'Stock listing',
    key: l => `${l.exchange_id.trim()}|${l.ticker_code.trim()}`,
    label: l => `${l.exchange_id} — ${l.ticker_code}`, detail: l => l.isin,
    ordered: true, localReason: null,
    sendable: l => !!l.exchange_id.trim() && !!l.ticker_code.trim(),
  },
  contacts: {
    section: 'contacts', entity: 'Contact',
    key: c => String(c.id), label: c => c.name, detail: c => c.email,
    ordered: false, localReason: 'The API has no contact write endpoint.',
  },
  wire_codes: {
    section: 'identifiers', entity: 'Wire code',
    key: w => String(w.wire_code_id), label: w => w.wire_code.code, detail: w => w.wire_code.name,
    ordered: false, localReason: 'The API has no wire-code write endpoint.',
  },
  rss_feeds: {
    section: 'distribution', entity: 'RSS feed',
    key: f => String(f.id), label: f => f.feed_name, detail: f => f.url || null,
    ordered: false, localReason: 'The API has no RSS write endpoint.',
  },
  relations: {
    section: 'basic-info', entity: 'Related company',
    key: r => String(r.id), label: r => r.related_company_name, detail: r => r.relation_type,
    ordered: false, localReason: 'The API has no relations endpoint.',
  },
  wire_services: {
    section: 'distribution', entity: 'Wire service',
    key: w => String(w.id), label: w => w.name, detail: w => w.email,
    ordered: false, localReason: 'The API has no wire-service endpoint.',
  },
}

/** "field: value" for each property that differs — how an edited item is shown. */
function describeItemEdit(before: object, after: object): [string, string] {
  const b = before as Record<string, unknown>
  const a = after as Record<string, unknown>
  const keys = Object.keys(a).filter(k => !same(b[k], a[k]))
  const show = (r: Record<string, unknown>) =>
    keys.map(k => `${k}: ${typeof r[k] === 'object' && r[k] !== null ? JSON.stringify(r[k]) : r[k] ?? '—'}`).join(', ')
  return [show(b), show(a)]
}

/** Wire ops for one item of an API-backed collection, at its draft position. */
function itemOps(name: CollectionName, item: unknown, index: number, kind: 'add' | 'move'): WireOp[] {
  if (name === 'sectors') {
    const s = item as ItemOf<'sectors'>
    return [{ kind: 'industry:put', name: s.sector_name, isPrimary: index === 0 }]
  }
  if (name === 'exchange_listings') {
    const l = item as ItemOf<'exchange_listings'>
    const at = { mic: l.exchange_id.trim(), ticker: l.ticker_code.trim(), isPrimary: index === 0, sortOrder: index }
    return [{ kind: kind === 'add' ? 'listing:create' : 'listing:update', ...at }]
  }
  return []
}

function removeOps(name: CollectionName, item: unknown): WireOp[] {
  if (name === 'sectors') {
    const s = item as ItemOf<'sectors'>
    return [{ kind: 'industry:delete', name: s.sector_name, fallbackId: s.sector_id }]
  }
  if (name === 'exchange_listings') {
    const l = item as ItemOf<'exchange_listings'>
    return [{ kind: 'listing:delete', mic: l.exchange_id.trim(), ticker: l.ticker_code.trim() }]
  }
  return []
}

function collectionChanges<K extends CollectionName>(name: K, base: CompanyFull, draft: CompanyFull): CompanyChange[] {
  const def = COLLECTIONS[name] as unknown as CollectionDef<ItemOf<K>>
  const sendable = def.sendable ?? (() => true)
  const beforeItems = base[name] as ItemOf<K>[]
  const afterItems = draft[name] as ItemOf<K>[]
  const before = new Map(beforeItems.map(i => [def.key(i), i]))
  const after = new Map(afterItems.map(i => [def.key(i), i]))
  const changes: CompanyChange[] = []

  const sync = (item: ItemOf<K>) =>
    def.localReason === null && sendable(item)
      ? { sync: 'api' as const }
      : { sync: 'local' as const, reason: def.localReason ?? 'Needs both an exchange and a ticker before it can be sent.' }

  afterItems.forEach((item, index) => {
    const key = def.key(item)
    const was = before.get(key)
    if (was === undefined) {
      const s = sync(item)
      changes.push({
        type: 'add', key: `${name}:${key}`, section: def.section, ...s,
        entity: def.entity, label: def.label(item), detail: def.detail(item),
        patch: { kind: 'upsert', collection: name, key, item },
        ops: s.sync === 'api' ? itemOps(name, item, index, 'add') : [],
      })
    } else if (!same(was, item)) {
      // Same item, different content. For the API-backed collections the key IS
      // the content the API stores (name; mic+ticker), so anything else that
      // changed — an ISIN, a sector type — is local.
      const [oldValue, newValue] = describeItemEdit(was, item)
      changes.push({
        type: 'edit', key: `${name}:${key}:edit`, section: def.section,
        sync: 'local', reason: def.localReason ?? 'The API stores only the key fields of this item.',
        field: `${name}:${key}`, label: `${def.entity}: ${def.label(item)}`,
        old_value: oldValue, new_value: newValue,
        patch: { kind: 'upsert', collection: name, key, item },
        ops: [],
      })
    }
  })

  for (const item of beforeItems) {
    const key = def.key(item)
    if (after.has(key)) continue
    const s = sync(item)
    changes.push({
      type: 'remove', key: `${name}:${key}`, section: def.section, ...s,
      entity: def.entity, label: def.label(item), detail: def.detail(item),
      patch: { kind: 'remove', collection: name, key },
      ops: s.sync === 'api' ? removeOps(name, item) : [],
    })
  }

  // Order. For listings every surviving row whose position moved needs its
  // sortOrder rewritten; for sectors only the primary flag is stored.
  if (def.ordered) {
    const beforeIndex = new Map(beforeItems.map((i, n) => [def.key(i), n]))
    const moved: WireOp[] = []
    afterItems.forEach((item, index) => {
      const was = beforeIndex.get(def.key(item))
      if (was === undefined || !sendable(item)) return
      const positionChanged = name === 'sectors' ? (was === 0) !== (index === 0) : was !== index
      if (positionChanged) moved.push(...itemOps(name, item, index, 'move'))
    })
    if (moved.length) {
      changes.push({
        type: 'edit', key: `${name}:order`, section: def.section, sync: 'api',
        field: `${name}:order`, label: `${def.entity} order`,
        old_value: beforeItems.map(def.label).join(', '),
        new_value: afterItems.map(def.label).join(', '),
        patch: { kind: 'order', collection: name, keys: afterItems.map(def.key) },
        ops: moved,
      })
    }
  }

  return changes
}

// ── The diff ────────────────────────────────────────────────────────────────

/** Everything that differs between `base` (the API version) and `draft`. */
export function diffCompany(base: CompanyFull, draft: CompanyFull): CompanyChange[] {
  const changes: CompanyChange[] = []
  for (const def of FIELDS) {
    const change = fieldChange(def, base, draft)
    if (change) changes.push(change)
  }
  changes.push(...languageChanges(base, draft))
  for (const name of Object.keys(COLLECTIONS) as CollectionName[]) {
    changes.push(...collectionChanges(name, base, draft))
  }
  return changes
}

/** The old name, kept for the dev preview. */
export const computeDiff = diffCompany

// ── Applying ────────────────────────────────────────────────────────────────

function setPath(record: CompanyFull, path: string, value: unknown): CompanyFull {
  const [head, ...rest] = path.split('.')
  if (rest.length === 0) return { ...record, [head]: value }
  const inner = (record as unknown as Record<string, Record<string, unknown>>)[head]
  return { ...record, [head]: { ...inner, [rest.join('.')]: value } }
}

/**
 * `changes` applied to `target`, in a fresh copy. Order patches run last, so
 * an item added by an earlier patch is placed where the draft had it.
 *
 * This is how a draft follows the API: diff the draft against the base it was
 * made from, then apply those changes to the newer API version. Whatever the
 * server changed in between is kept; whatever the user changed wins.
 */
export function applyChanges(target: CompanyFull, changes: CompanyChange[]): CompanyFull {
  let record = structuredClone(target)
  const patches = changes.map(c => c.patch)
  const ordered = [...patches.filter(p => p.kind !== 'order'), ...patches.filter(p => p.kind === 'order')]

  for (const patch of ordered) {
    switch (patch.kind) {
      case 'set':
        record = setPath(record, patch.path, structuredClone(patch.value))
        break
      case 'language':
        record = { ...record, ...setLanguageState(record, patch.code, patch.state) }
        break
      case 'upsert': {
        const def = COLLECTIONS[patch.collection] as CollectionDef<unknown>
        const items = record[patch.collection] as unknown[]
        const at = items.findIndex(i => def.key(i) === patch.key)
        const next = [...items]
        if (at === -1) next.push(structuredClone(patch.item))
        else next[at] = structuredClone(patch.item)
        record = { ...record, [patch.collection]: next }
        break
      }
      case 'remove': {
        const def = COLLECTIONS[patch.collection] as CollectionDef<unknown>
        const items = record[patch.collection] as unknown[]
        record = { ...record, [patch.collection]: items.filter(i => def.key(i) !== patch.key) }
        break
      }
      case 'order': {
        const def = COLLECTIONS[patch.collection] as CollectionDef<unknown>
        const items = record[patch.collection] as unknown[]
        const rank = new Map(patch.keys.map((k, n) => [k, n]))
        const placed = items.filter(i => rank.has(def.key(i)))
          .sort((a, b) => rank.get(def.key(a))! - rank.get(def.key(b))!)
        const rest = items.filter(i => !rank.has(def.key(i)))
        record = { ...record, [patch.collection]: [...placed, ...rest] }
        break
      }
    }
  }
  return record
}

// ── Conflicts ───────────────────────────────────────────────────────────────

export interface Conflict {
  key: string
  label: string
  /** What the draft wants. */
  mine: unknown
  /** What the API holds now. */
  theirs: unknown
}

/** A change's resulting value, for comparing two changes to the same thing. */
function outcome(change: CompanyChange): unknown {
  const p = change.patch
  switch (p.kind) {
    case 'set': return blankToNull(p.value)
    case 'language': return p.state
    case 'upsert': return p.item
    case 'remove': return null
    case 'order': return p.keys
  }
}

const display = (change: CompanyChange): unknown =>
  change.type === 'edit' ? change.new_value : change.type === 'add' ? `${change.label} (added)` : `${change.label} (removed)`

/**
 * Changes the user made that someone else also made, differently, since the
 * draft's base was fetched. `mine` = diff(base, draft); `theirs` = diff(base, fresh).
 */
export function findConflicts(mine: CompanyChange[], theirs: CompanyChange[]): Conflict[] {
  const theirsByKey = new Map(theirs.map(c => [c.key, c]))
  const conflicts: Conflict[] = []
  for (const change of mine) {
    const other = theirsByKey.get(change.key)
    if (!other || same(outcome(change), outcome(other))) continue
    conflicts.push({
      key: change.key,
      label: change.type === 'edit' ? change.label : `${change.entity}: ${change.label}`,
      mine: display(change),
      theirs: display(other),
    })
  }
  return conflicts
}
