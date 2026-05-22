import type { CompanyFull } from '../types/company.types'

export const MOCK_COMPANY: CompanyFull = {
  id: 1,
  name_en: 'Mitsubishi Heavy Industries, Ltd.',
  name_zh_hans: '三菱重工业株式会社',
  name_zh_hant: '三菱重工業株式會社',
  name_ja: '三菱重工業株式会社',
  name_ko: '미쓰비시 중공업',
  status: 'active',
  logo_article_url: null,
  logo_top_url: null,
  url: 'https://www.mhi.com',
  blog: null,
  facebook: 'https://www.facebook.com/MitsubishiHeavyIndustries',
  twitter: 'https://twitter.com/MHI_Group',
  youtube: null,
  linkedin: 'https://www.linkedin.com/company/mitsubishi-heavy-industries',
  telegram: null,
  instagram: 'https://www.instagram.com/mhi_groupjp',
  established: '1971/02/01',
  exchange_listed_date: '1971/02/01',
  employees: '1000+',
  duns_number: '00-123-4567',
  otc: null,
  market_id: null,
  url_ja: 'https://www.mhi.com/jp',
  address_street: '2-3, Marunouchi 3-chome',
  address_district: 'Chiyoda-ku',
  address_city: 'Tokyo 100-8332',
  address_country: 'Japan',
  telephone: '+81 3 0000 0000',
  facsimile: '+81 3 0000 0000',
  company_email: null,
  key_person_1_name: 'Eisaku Ito',
  key_person_1_title: 'Chief Executive Officer',
  key_person_2_name: 'Junichiro Kakihara',
  key_person_2_title: 'Executive Vice President',
  about_html: '<p>Mitsubishi Heavy Industries (MHI) is one of the world\'s leading industrial companies.</p>',
  about_prosemirror: null,
  languages: ['EN', 'JA', 'ZH-HANS'],
  created_at: '2020-01-15T08:00:00Z',
  updated_at: '2024-11-01T12:34:00Z',
  created_by: 1,
  updated_by: 4,
  annual_report_url: 'https://www.mhi.com/docs/MHI_AR2026.pdf',
  annual_report_name: 'MHI_AR2026.pdf',
  annual_report_date: '2024/03/31',
  annual_report_size: '4.2 MB',
  portal_username: 'mhi.jp.123',
  portal_password: '************',
  updated_by_name: 'Krischan Balasbas',

  contacts: [
    {
      id: 1,
      company_id: 1,
      name: 'Kengo Tatsukawa',
      position: 'Communications & PR',
      email: 'kengo_tatsukawa@mhi.co.jp',
      phone: '81-3-6716-2168',
      fax: 'kengo_tatsukawa@mhi.co.jp',
      contact_type: 'freetext',
      email_format: 'html',
      notes: null,
      sort_order: 1,
      created_at: '2020-01-15T08:00:00Z',
      updated_at: '2024-11-01T12:34:00Z'
    },
    {
      id: 2,
      company_id: 1,
      name: 'Kenichi Nakamura',
      position: null,
      email: 'kenichi_nakamura@mhi.co.jp',
      phone: null,
      fax: null,
      contact_type: 'freetext',
      email_format: 'html',
      notes: null,
      sort_order: 2,
      created_at: '2021-03-10T08:00:00Z',
      updated_at: '2024-11-01T12:34:00Z'
    },
    {
      id: 3,
      company_id: 1,
      name: 'Kazuyo Takeda',
      position: null,
      email: 'kazuyo.takeda@jcnnewswire.com',
      phone: null,
      fax: null,
      contact_type: 'freetext',
      email_format: 'html',
      notes: null,
      sort_order: 3,
      created_at: '2022-05-01T08:00:00Z',
      updated_at: '2024-11-01T12:34:00Z'
    }
  ],

  sectors: [
    { id: 1, company_id: 1, sector_id: 1, sector_type: 'Business', sector_name: 'ASEAN' },
    { id: 2, company_id: 1, sector_id: 2, sector_type: 'Business', sector_name: 'Government' },
    { id: 3, company_id: 1, sector_id: 3, sector_type: 'Environment', sector_name: 'Alternative Energy' },
    { id: 4, company_id: 1, sector_id: 4, sector_type: 'Environment', sector_name: 'EVs, Transportation' },
    { id: 5, company_id: 1, sector_id: 5, sector_type: 'Industry', sector_name: 'Aerospace & Defence' },
    { id: 6, company_id: 1, sector_id: 6, sector_type: 'Industry', sector_name: 'Engineering' },
  ],

  exchange_listings: [
    {
      id: 1,
      company_id: 1,
      exchange_id: 'XTKS',
      exchange_name: 'Tokyo Stock Exchange',
      ticker_code: '7011',
      isin: 'JP3900000005',
      sedol: '6597672',
      cusip: null,
      created_at: '2020-01-15T08:00:00Z',
      updated_at: '2024-11-01T12:34:00Z'
    },
    {
      id: 2,
      company_id: 1,
      exchange_id: 'OOTC',
      exchange_name: 'OTC US',
      ticker_code: 'MHVIY',
      isin: 'US6068221042',
      sedol: 'B04MYG7',
      cusip: '606822104',
      created_at: '2020-01-15T08:00:00Z',
      updated_at: '2024-11-01T12:34:00Z'
    },
    {
      id: 3,
      company_id: 1,
      exchange_id: 'OOTC',
      exchange_name: 'OTC US',
      ticker_code: 'MHVYF',
      isin: 'US6068221042',
      sedol: 'B04MYG7',
      cusip: '606822104',
      created_at: '2020-01-15T08:00:00Z',
      updated_at: '2024-11-01T12:34:00Z'
    },
    {
      id: 4,
      company_id: 1,
      exchange_id: 'XFRA',
      exchange_name: 'Frankfurt Stock Exchange',
      ticker_code: 'MIH',
      isin: 'DE000A0D9PT0',
      sedol: 'B04MYG7',
      cusip: null,
      created_at: '2020-01-15T08:00:00Z',
      updated_at: '2024-11-01T12:34:00Z'
    },
  ],

  wire_codes: [
    {
      id: 1,
      company_id: 1,
      wire_code_id: 6,
      wire_code: { id: 6, source: 'reuters', code_type: 'category', code: 'ASIA', name: 'Asia' }
    },
    {
      id: 2,
      company_id: 1,
      wire_code_id: 9,
      wire_code: { id: 9, source: 'reuters', code_type: 'category', code: 'JP', name: 'Japan' }
    },
    {
      id: 3,
      company_id: 1,
      wire_code_id: 11,
      wire_code: { id: 11, source: 'reuters', code_type: 'category', code: 'NEWR', name: 'News Releases' }
    },
  ],

  rss_feeds: [
    {
      id: 1,
      company_id: 1,
      feed_name: 'ACN Newswire - Asia',
      url: 'https://www.acnnewswire.com/rss/sector/211',
      sector_id: 101,
      sector_name: 'Aerospace & Defense',
      status: 'active',
      created_at: '2022-05-01T08:00:00Z',
      updated_at: '2024-11-01T12:34:00Z'
    },
    {
      id: 2,
      company_id: 1,
      feed_name: 'ACN Newswire - Japan',
      url: 'https://www.acnnewswire.com/rss/sector/211',
      sector_id: 102,
      sector_name: 'Engineering',
      status: 'active',
      created_at: '2022-05-01T08:00:00Z',
      updated_at: '2024-11-01T12:34:00Z'
    },
    {
      id: 3,
      company_id: 1,
      feed_name: 'ACN Newswire - Marine',
      url: 'https://www.acnnewswire.com/rss/sector/211',
      sector_id: 103,
      sector_name: 'Marine & Offshore',
      status: 'paused',
      created_at: '2022-05-01T08:00:00Z',
      updated_at: '2024-11-01T12:34:00Z'
    }
  ],

  relations: [
    {
      id: 1,
      company_id: 1,
      related_company_id: 42,
      related_company_name: 'Mitsubishi Electric Corporation',
      relation_type: 'sister'
    }
  ],

  wire_services: [
    { id: 1, company_id: 1, name: 'Delilah Lin', email: 'news@energytrend.com', country: 'Taiwan' },
    { id: 2, company_id: 1, name: 'editorial@energystmedia.com', email: 'editorial@energystmedia.com', country: 'UK' },
    { id: 3, company_id: 1, name: 'Ian Stuart', email: 'istuart@nacleanenergy.com', country: 'USA' },
    { id: 4, company_id: 1, name: 'Mikaila Adams', email: 'madams@endeavorb2b.com', country: 'USA' },
    { id: 5, company_id: 1, name: 'Nikkan Kogyo editor', email: 'newsrelease@po.nikkan.co.jp', country: 'Japan' },
    { id: 6, company_id: 1, name: 'Editor Rita Brown', email: 'editor@energyvoice.com', country: 'UK' },
  ],

  delivery_settings: {
    allow_access: true,
    show_photos: true,
    show_banner: true,
    company_will_mail: true,
    show_extended_boilerplate: true,
    show_archives: true,
    show_alerts: true,
    delivery_method: 'express'
  },
}

export const MOCK_REUTERS_CODES = [
  { id: 1, code: 'ADV', name: 'Advertising' },
  { id: 2, code: 'AER', name: 'Aerospace' },
  { id: 3, code: 'AIR', name: 'Air Transport' },
  { id: 4, code: 'AUT', name: 'Automobiles, Equipment' },
  { id: 5, code: 'BIO', name: 'Biotechnology' },
  { id: 6, code: 'ASIA', name: 'Asia' },
  { id: 7, code: 'ENQ', name: 'Energy Equipment' },
  { id: 8, code: 'IND', name: 'Industrial Equipment' },
  { id: 9, code: 'JP', name: 'Japan' },
  { id: 10, code: 'MAC', name: 'Metal Goods and Engineering' },
  { id: 11, code: 'NEWR', name: 'News Releases' },
  { id: 12, code: 'CHM', name: 'Chemicals' },
  { id: 13, code: 'CON', name: 'Construction' },
  { id: 14, code: 'DEF', name: 'Defense' },
  { id: 15, code: 'ENV', name: 'Environment' },
]

export const MOCK_BLOOMBERG_CODES = [
  { id: 1, code: 'ASIA', name: 'Asia, Pacific Rim' },
  { id: 2, code: 'COS', name: 'Companies' },
  { id: 3, code: 'CST', name: 'Construction & Engineering' },
  { id: 4, code: 'NRG', name: 'Energy' },
  { id: 5, code: 'JAPAN', name: 'Japan' },
  { id: 6, code: 'JPS', name: 'Japanese Stock Market' },
  { id: 7, code: 'MAC', name: 'Machinery, Manufacturing' },
  { id: 8, code: 'TECH', name: 'Technology' },
  { id: 9, code: 'FIN', name: 'Financial Services' },
  { id: 10, code: 'MFG', name: 'Manufacturing' },
  { id: 11, code: 'TRN', name: 'Transportation' },
  { id: 12, code: 'UTL', name: 'Utilities' },
]

export const MOCK_SECTORS = [
  { id: 1, sector_type: 'Business', sector_name: 'ASEAN' },
  { id: 2, sector_type: 'Business', sector_name: 'Government' },
  { id: 3, sector_type: 'Environment', sector_name: 'Alternative Energy' },
  { id: 4, sector_type: 'Environment', sector_name: 'EVs, Transportation' },
  { id: 5, sector_type: 'Industry', sector_name: 'Aerospace & Defence' },
  { id: 6, sector_type: 'Industry', sector_name: 'Engineering' },
  { id: 7, sector_type: 'Technology', sector_name: 'Artificial Intelligence' },
  { id: 8, sector_type: 'Technology', sector_name: 'Semiconductors' },
  { id: 9, sector_type: 'Finance', sector_name: 'Banking' },
  { id: 10, sector_type: 'Finance', sector_name: 'Capital Markets' },
]
