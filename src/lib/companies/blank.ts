// src/lib/companies/blank.ts
// The empty CompanyFull every "new company" starts from.
//
// Both entry points need this shape — the list page's "+ New company" button
// and the spreadsheet view, where typing into a blank row creates a record —
// and a field missing from one copy but not the other is exactly the drift
// `normalize.ts` exists to clean up after. One builder, used by both.

import type { CompanyFull } from '../../types/company.types'

export function blankCompany(id: number, name = 'New Company'): CompanyFull {
  const now = new Date().toISOString()
  return {
    id,
    name_en: name,
    name_zh_hans: null,
    name_zh_hant: null,
    name_ja: null,
    name_ko: null,
    status: 'draft',
    logo_article_url: null,
    logo_top_url: null,
    url: null,
    blog: null,
    facebook: null,
    twitter: null,
    youtube: null,
    linkedin: null,
    telegram: null,
    instagram: null,
    established: null,
    exchange_listed_date: null,
    employees: null,
    duns_number: null,
    otc: null,
    market_id: null,
    url_ja: null,
    address_street: null,
    address_district: null,
    address_city: null,
    address_country: null,
    telephone: null,
    facsimile: null,
    company_email: null,
    key_person_1_name: null,
    key_person_1_title: null,
    key_person_2_name: null,
    key_person_2_title: null,
    about_html: null,
    about_prosemirror: null,
    languages: [],
    secondary_languages: [],
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    annual_report_url: null,
    annual_report_name: null,
    annual_report_date: null,
    annual_report_size: null,
    portal_username: null,
    portal_password: null,
    updated_by_name: null,
    contacts: [],
    sectors: [],
    exchange_listings: [],
    wire_codes: [],
    rss_feeds: [],
    relations: [],
    wire_services: [],
    delivery_settings: {
      allow_access: false,
      show_photos: false,
      show_banner: false,
      company_will_mail: false,
      show_extended_boilerplate: false,
      show_archives: false,
      show_alerts: false,
      delivery_method: 'standard',
    },
  }
}
