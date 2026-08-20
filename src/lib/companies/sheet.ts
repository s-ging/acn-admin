// src/lib/companies/sheet.ts
// The company projection for the spreadsheet view: which columns exist, and how
// a company is read, written and created. Everything generic lives in lib/sheet.
//
// Nested collections — contacts, exchange listings, sectors, wire codes, RSS
// feeds, relations — have no sensible flat cell form, so they appear as
// read-only summary columns and stay editable only in the company editor.

import { blankCompany } from './blank'
import { loadCompanies, loadCompany, nextCompanyId, saveCompany } from './storage'
import type { SheetColumn, SheetSource } from '../sheet/schema'
import type { CompanyFull } from '../../types/company.types'

const STATUS_OPTIONS = ['active', 'draft', 'inactive'] as const

const COLUMNS: readonly SheetColumn<CompanyFull>[] = [
  { key: 'id', header: 'ID', width: 64, kind: 'id' },

  // ── Identity ────────────────────────────────────────────────────────────
  { key: 'name_en', header: 'Name (EN)', width: 240, kind: 'text' },
  { key: 'status', header: 'Status', width: 90, kind: 'enum', options: STATUS_OPTIONS },
  { key: 'name_zh_hans', header: 'Name (ZH-Hans)', width: 160, kind: 'text' },
  { key: 'name_zh_hant', header: 'Name (ZH-Hant)', width: 160, kind: 'text' },
  { key: 'name_ja', header: 'Name (JA)', width: 160, kind: 'text' },
  { key: 'name_ko', header: 'Name (KO)', width: 160, kind: 'text' },

  // ── Languages ───────────────────────────────────────────────────────────
  // Comma-separated on the way out, split and trimmed on the way back in.
  { key: 'languages', header: 'Main language', width: 110, kind: 'langs' },
  { key: 'secondary_languages', header: 'Other languages', width: 140, kind: 'langs' },

  // ── Web ─────────────────────────────────────────────────────────────────
  { key: 'url', header: 'Website', width: 200, kind: 'text' },
  { key: 'url_ja', header: 'Website (JA)', width: 180, kind: 'text' },
  { key: 'blog', header: 'Blog', width: 160, kind: 'text' },

  // ── Address ─────────────────────────────────────────────────────────────
  { key: 'address_street', header: 'Street', width: 200, kind: 'text' },
  { key: 'address_district', header: 'District', width: 140, kind: 'text' },
  { key: 'address_city', header: 'City', width: 140, kind: 'text' },
  { key: 'address_country', header: 'Country', width: 140, kind: 'text' },

  // ── Contact ─────────────────────────────────────────────────────────────
  { key: 'telephone', header: 'Telephone', width: 150, kind: 'text' },
  { key: 'facsimile', header: 'Fax', width: 150, kind: 'text' },
  { key: 'company_email', header: 'Email', width: 200, kind: 'text' },

  // ── Key people ──────────────────────────────────────────────────────────
  { key: 'key_person_1_name', header: 'Key person 1', width: 160, kind: 'text' },
  { key: 'key_person_1_title', header: 'Title 1', width: 160, kind: 'text' },
  { key: 'key_person_2_name', header: 'Key person 2', width: 160, kind: 'text' },
  { key: 'key_person_2_title', header: 'Title 2', width: 160, kind: 'text' },

  // ── Company details ─────────────────────────────────────────────────────
  { key: 'established', header: 'Established', width: 110, kind: 'text' },
  { key: 'exchange_listed_date', header: 'Listed date', width: 110, kind: 'text' },
  { key: 'employees', header: 'Employees', width: 100, kind: 'text' },

  // ── Identifiers ─────────────────────────────────────────────────────────
  { key: 'duns_number', header: 'DUNS', width: 120, kind: 'text' },
  { key: 'otc', header: 'OTC', width: 100, kind: 'text' },
  { key: 'market_id', header: 'Market ID', width: 110, kind: 'text' },

  // ── Social ──────────────────────────────────────────────────────────────
  { key: 'facebook', header: 'Facebook', width: 160, kind: 'text' },
  { key: 'twitter', header: 'Twitter', width: 160, kind: 'text' },
  { key: 'linkedin', header: 'LinkedIn', width: 160, kind: 'text' },
  { key: 'youtube', header: 'YouTube', width: 160, kind: 'text' },
  { key: 'instagram', header: 'Instagram', width: 160, kind: 'text' },
  { key: 'telegram', header: 'Telegram', width: 160, kind: 'text' },

  // ── Derived — read-only, owned by the company editor ─────────────────────
  {
    key: 'primary_listing',
    header: 'Primary listing',
    width: 150,
    kind: 'derived',
    get: c => {
      const listing = c.exchange_listings[0]
      return listing ? `${listing.exchange_id} · ${listing.ticker_code}` : ''
    },
  },
  {
    key: 'listings_count',
    header: 'Listings',
    width: 80,
    kind: 'derived',
    get: c => String(c.exchange_listings.length),
  },
  {
    key: 'sectors',
    header: 'Sectors',
    width: 200,
    kind: 'derived',
    get: c => [...new Set(c.sectors.map(s => s.sector_type))].join(', '),
  },
  {
    key: 'contacts_count',
    header: 'Contacts',
    width: 80,
    kind: 'derived',
    get: c => String(c.contacts.length),
  },
  {
    key: 'updated_at',
    header: 'Modified',
    width: 150,
    kind: 'derived',
    get: c => (c.updated_at ? c.updated_at.slice(0, 16).replace('T', ' ') : ''),
  },
  {
    key: 'updated_by_name',
    header: 'Modified by',
    width: 140,
    kind: 'derived',
    get: c => c.updated_by_name ?? '',
  },
]

export const companySheetSource: SheetSource<CompanyFull> = {
  title: 'Companies',
  listRoute: '/companies',
  columns: COLUMNS,
  load: loadCompanies,
  loadOne: id => loadCompany(id),
  save: company => {
    saveCompany(company)
    return { ok: true }
  },
  create: () => blankCompany(nextCompanyId(), ''),
  idOf: company => company.id,
  touch: company => ({ ...company, updated_at: new Date().toISOString() }),
  ensureLabel: company =>
    company.name_en ? company : { ...company, name_en: 'New Company' },
}
