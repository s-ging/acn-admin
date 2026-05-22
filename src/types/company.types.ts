export type LanguageCode = 'EN' | 'ZH-HANS' | 'ZH-HANT' | 'JA' | 'KO'
export type CompanyStatus = 'active' | 'inactive' | 'draft'
export type RelationType = 'parent' | 'subsidiary' | 'sister' | 'jv_partner' | 'other'
export type WireSource = 'bloomberg' | 'reuters' | 'rss' | 'wireservice'
export type ContactType = 'freetext' | 'html' | 'pdf'
export type EmailFormat = 'html' | 'text'
export type Tab = 'basic-info' | 'contacts' | 'distribution' | 'identifiers' | 'company-details'
export type Modal = 'commit' | 'csv-import' | 'json-export' | 'json-import' | null

export interface Company {
  id: number
  name_en: string
  name_zh_hans: string | null
  name_zh_hant: string | null
  name_ja: string | null
  name_ko: string | null
  status: CompanyStatus
  logo_article_url: string | null
  logo_top_url: string | null
  url: string | null
  blog: string | null
  facebook: string | null
  twitter: string | null
  youtube: string | null
  linkedin: string | null
  telegram: string | null
  instagram: string | null
  established: string | null
  exchange_listed_date: string | null
  employees: string | null
  duns_number: string | null
  otc: string | null
  market_id: string | null
  url_ja: string | null
  address_street: string | null
  address_district: string | null
  address_city: string | null
  address_country: string | null
  telephone: string | null
  facsimile: string | null
  company_email: string | null
  key_person_1_name: string | null
  key_person_1_title: string | null
  key_person_2_name: string | null
  key_person_2_title: string | null
  about_html: string | null
  about_prosemirror: object | null
  languages: LanguageCode[]
  created_at: string
  updated_at: string
  created_by: number | null
  updated_by: number | null
  annual_report_url: string | null
  annual_report_name: string | null
  annual_report_date: string | null
  annual_report_size: string | null
  portal_username: string | null
  portal_password: string | null
  updated_by_name: string | null
}

export interface CompanyContact {
  id: number
  company_id: number
  name: string
  position: string | null
  email: string | null
  phone: string | null
  fax: string | null
  contact_type: ContactType
  email_format: EmailFormat
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CompanySector {
  id: number
  company_id: number
  sector_id: number
  sector_type: string
  sector_name: string
}

export interface ExchangeListing {
  id: number
  company_id: number
  exchange_id: string
  exchange_name: string
  ticker_code: string
  isin: string | null
  sedol: string | null
  cusip: string | null
  created_at: string
  updated_at: string
}

export interface WireCode {
  id: number
  source: WireSource
  code_type: string
  code: string
  name: string
}

export interface CompanyWireCode {
  id: number
  company_id: number
  wire_code_id: number
  wire_code: WireCode
}

export interface RSSFeed {
  id: number
  company_id: number
  feed_name: string
  url: string
  sector_id: number | null
  sector_name: string | null
  status: 'active' | 'paused'
  created_at: string
  updated_at: string
}

export interface CompanyRelation {
  id: number
  company_id: number
  related_company_id: number
  related_company_name: string
  relation_type: RelationType
}

export interface WireService {
  id: number
  company_id: number
  name: string
  email: string
  country: string
}

export interface DeliverySettings {
  allow_access: boolean
  show_photos: boolean
  show_banner: boolean
  company_will_mail: boolean
  show_extended_boilerplate: boolean
  show_archives: boolean
  show_alerts: boolean
  delivery_method: 'express' | 'standard' | 'digest'
}

export interface CompanyFull extends Company {
  contacts: CompanyContact[]
  sectors: CompanySector[]
  exchange_listings: ExchangeListing[]
  wire_codes: CompanyWireCode[]
  rss_feeds: RSSFeed[]
  relations: CompanyRelation[]
  wire_services: WireService[]
  delivery_settings: DeliverySettings
}

export type ChangeType = 'edit' | 'add' | 'remove'
export type ChangeSection = 'basic-info' | 'contacts' | 'distribution' | 'identifiers' | 'company-details'

export interface FieldChange {
  type: 'edit'
  section: ChangeSection
  field: string
  label: string
  old_value: unknown
  new_value: unknown
}

export interface RecordChange {
  type: 'add' | 'remove'
  section: ChangeSection
  entity: string
  label: string
  detail: string | null
}

export type Change = FieldChange | RecordChange
