import type {
  CompanyFull,
  Change,
  FieldChange,
  RecordChange,
  ChangeSection,
} from '../../types/company.types'

type ScalarKey = keyof CompanyFull

interface ScalarDef {
  field: ScalarKey
  label: string
  section: ChangeSection
}

const SCALAR_FIELDS: ScalarDef[] = [
  { field: 'name_en',       label: 'Company name (EN)',      section: 'basic-info' },
  { field: 'name_zh_hans',  label: 'Company name (ZH-HANS)', section: 'basic-info' },
  { field: 'name_zh_hant',  label: 'Company name (ZH-HANT)', section: 'basic-info' },
  { field: 'name_ja',       label: 'Company name (JA)',      section: 'basic-info' },
  { field: 'name_ko',       label: 'Company name (KO)',      section: 'basic-info' },
  { field: 'status',        label: 'Status',                 section: 'basic-info' },
  { field: 'url',           label: 'Homepage',               section: 'basic-info' },
  { field: 'blog',          label: 'Blog',                   section: 'basic-info' },
  { field: 'linkedin',      label: 'LinkedIn',               section: 'basic-info' },
  { field: 'twitter',       label: 'Twitter / X',            section: 'basic-info' },
  { field: 'facebook',      label: 'Facebook',               section: 'basic-info' },
  { field: 'youtube',       label: 'YouTube',                section: 'basic-info' },
  { field: 'telegram',      label: 'Telegram',               section: 'basic-info' },
  { field: 'instagram',     label: 'Instagram',              section: 'basic-info' },
  { field: 'about_html',        label: 'About / Boilerplate',    section: 'basic-info' },
  { field: 'logo_article_url',  label: 'Article page logo',      section: 'basic-info' },
  { field: 'logo_top_url',      label: 'Top page logo',          section: 'basic-info' },
  { field: 'annual_report_name', label: 'Annual report',         section: 'basic-info' },
  { field: 'annual_report_url',  label: 'Annual report file',    section: 'basic-info' },
  { field: 'annual_report_date', label: 'Annual report date',    section: 'basic-info' },
  { field: 'annual_report_size', label: 'Annual report size',    section: 'basic-info' },
  { field: 'telephone',     label: 'Telephone',              section: 'company-details' },
  { field: 'facsimile',     label: 'Fax',                    section: 'company-details' },
  { field: 'company_email', label: 'Company email',          section: 'company-details' },
  { field: 'address_street',  label: 'Address',              section: 'company-details' },
  { field: 'address_city',    label: 'City',                 section: 'company-details' },
  { field: 'address_country', label: 'Country',              section: 'company-details' },
  { field: 'established',   label: 'Established',            section: 'company-details' },
  { field: 'employees',     label: 'Employees',              section: 'company-details' },
  { field: 'duns_number',   label: 'DUNS number',            section: 'company-details' },
]

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function computeDiff(original: CompanyFull, draft: CompanyFull): Change[] {
  const changes: Change[] = []

  // Scalar fields
  for (const { field, label, section } of SCALAR_FIELDS) {
    const oldVal = original[field]
    const newVal = draft[field]
    if (oldVal !== newVal) {
      const change: FieldChange = { type: 'edit', section, field, label, old_value: oldVal, new_value: newVal }
      changes.push(change)
    }
  }

  // Languages (order-independent)
  const origLangs = new Set(original.languages)
  const draftLangs = new Set(draft.languages)
  for (const lang of draftLangs) {
    if (!origLangs.has(lang)) {
      const change: RecordChange = { type: 'add', section: 'basic-info', entity: 'Language', label: lang, detail: null }
      changes.push(change)
    }
  }
  for (const lang of origLangs) {
    if (!draftLangs.has(lang)) {
      const change: RecordChange = { type: 'remove', section: 'basic-info', entity: 'Language', label: lang, detail: null }
      changes.push(change)
    }
  }

  // Contacts
  const origContacts = new Map(original.contacts.map(c => [c.id, c]))
  const draftContacts = new Map(draft.contacts.map(c => [c.id, c]))
  for (const [id, c] of draftContacts) {
    if (!origContacts.has(id)) {
      changes.push({ type: 'add', section: 'contacts', entity: 'Contact', label: c.name, detail: c.email })
    }
  }
  for (const [id, c] of origContacts) {
    if (!draftContacts.has(id)) {
      changes.push({ type: 'remove', section: 'contacts', entity: 'Contact', label: c.name, detail: c.email })
    }
  }

  // Sectors
  const origSectors = new Map(original.sectors.map(s => [s.sector_id, s]))
  const draftSectors = new Map(draft.sectors.map(s => [s.sector_id, s]))
  for (const [id, s] of draftSectors) {
    if (!origSectors.has(id)) {
      changes.push({ type: 'add', section: 'basic-info', entity: 'Sector', label: s.sector_name, detail: s.sector_type })
    }
  }
  for (const [id, s] of origSectors) {
    if (!draftSectors.has(id)) {
      changes.push({ type: 'remove', section: 'basic-info', entity: 'Sector', label: s.sector_name, detail: s.sector_type })
    }
  }

  // Wire codes
  const origWireCodes = new Map(original.wire_codes.map(w => [w.wire_code_id, w]))
  const draftWireCodes = new Map(draft.wire_codes.map(w => [w.wire_code_id, w]))
  for (const [id, w] of draftWireCodes) {
    if (!origWireCodes.has(id)) {
      changes.push({ type: 'add', section: 'identifiers', entity: `${capitalize(w.wire_code.source)} code`, label: w.wire_code.code, detail: w.wire_code.name })
    }
  }
  for (const [id, w] of origWireCodes) {
    if (!draftWireCodes.has(id)) {
      changes.push({ type: 'remove', section: 'identifiers', entity: `${capitalize(w.wire_code.source)} code`, label: w.wire_code.code, detail: w.wire_code.name })
    }
  }

  // Exchange listings
  const origListings = new Map(original.exchange_listings.map(e => [e.id, e]))
  const draftListings = new Map(draft.exchange_listings.map(e => [e.id, e]))
  for (const [id, e] of draftListings) {
    if (!origListings.has(id)) {
      changes.push({ type: 'add', section: 'identifiers', entity: 'Stock listing', label: `${e.exchange_id} — ${e.ticker_code}`, detail: e.isin })
    }
  }
  for (const [id, e] of origListings) {
    if (!draftListings.has(id)) {
      changes.push({ type: 'remove', section: 'identifiers', entity: 'Stock listing', label: `${e.exchange_id} — ${e.ticker_code}`, detail: e.isin })
    }
  }

  // Wire services
  const origWireServices = new Map(original.wire_services.map(w => [w.id, w]))
  const draftWireServices = new Map(draft.wire_services.map(w => [w.id, w]))
  for (const [id, w] of draftWireServices) {
    if (!origWireServices.has(id)) {
      changes.push({ type: 'add', section: 'distribution', entity: 'Wire service', label: w.name, detail: w.email })
    }
  }
  for (const [id, w] of origWireServices) {
    if (!draftWireServices.has(id)) {
      changes.push({ type: 'remove', section: 'distribution', entity: 'Wire service', label: w.name, detail: w.email })
    }
  }

  // RSS feeds
  const origFeeds = new Map(original.rss_feeds.map(f => [f.id, f]))
  const draftFeeds = new Map(draft.rss_feeds.map(f => [f.id, f]))
  for (const [id, f] of draftFeeds) {
    if (!origFeeds.has(id)) {
      changes.push({ type: 'add', section: 'distribution', entity: 'RSS feed', label: f.feed_name, detail: f.url })
    }
  }
  for (const [id, f] of origFeeds) {
    if (!draftFeeds.has(id)) {
      changes.push({ type: 'remove', section: 'distribution', entity: 'RSS feed', label: f.feed_name, detail: f.url })
    }
  }

  return changes
}
