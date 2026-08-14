// src/lib/press-releases/mock.ts
// Seeded press releases, written to localStorage alongside the seed companies.
//
// Company ids match dev/seed.ts, so the derived classification on each of these
// resolves against a company that actually exists. `sector_type` / `industries`
// below are what the derivation produces — they are stored, not authored, and
// recompute the moment the company selection changes.

import type { PressRelease } from '../../types/press-release.types'

// Datavault AI (Technology / Artificial Intel [AI]) — one company, so it is
// also the primary issuer. Classification left as derived.
export const DATAVAULT_RELEASE: PressRelease = {
  id: 2001,
  article_id: 'ACN-2001',
  company_ids: [134],
  primary_issuer_id: 134,

  headline: 'Datavault AI Expands Data Science Platform with New Acoustic Licensing Partners',
  subheadline: 'Agreements broaden the reach of the company\'s patented data valuation and acoustic science platforms across Asia',
  summary: 'Datavault AI Inc. (NASDAQ: DVLT) today announced a set of licensing agreements that extend its Data Science and Acoustic Science platforms into new markets across the Asia-Pacific region.',
  body_html: '<p>BEAVERTON, OR, August 12, 2026 - Datavault AI Inc. (NASDAQ: DVLT), a technology licensing company whose patented platforms redefine how data is managed, valued and monetized, today announced a set of licensing agreements extending its Data Science and Acoustic Science platforms into new markets across Asia-Pacific.</p><p>The agreements cover both of the company\'s synergistic platforms and are expected to contribute to licensing revenue from the current quarter onward.</p><p>"Our platforms were built to travel," said Nathaniel Bradley, Chief Executive Officer. "These agreements put the technology in front of partners who already understand the value of the underlying data."</p>',
  dateline_overridden: true,
  custom_about_html: null,

  published_at: '2026-08-12T09:00:00Z',
  status: 'published',

  sector_type: 'Technology',
  industries: ['Artificial Intel [AI]'],
  topic: 'Partnership',
  classification_overridden: false,
  languages: ['EN'],
  secondary_languages: [],

  region: 'North America',
  location: 'Beaverton, Oregon',

  supplier: 'ACN Newswire',
  contacts: [
    { id: 1, name: 'Alan Wallace',  position: 'Head of Public Relations', email: 'alan.wallace@dvlt.ai',  phone: null },
    { id: 2, name: 'Edward Barger', position: 'VP, Investor Relations',   email: 'edward.barger@dvlt.ai', phone: null },
  ],
  translations: [{ language: 'EN', url: 'https://www.acnnewswire.com/press-release/english/2001' }],

  article_type: 'Press Release',
  tracking_id: 'ACN20260812-DVLT',
  distribute_to: 'Full Wire',
  source: 'ACN Newswire',

  report_by: 'Krischan Balasbas',
  send_by: 'Shirley Chang',

  created_at: '2026-08-11T14:00:00Z',
  updated_at: '2026-08-12T09:00:00Z',
  updated_by_name: 'Krischan Balasbas',
}

// Three companies of equal standing, with Toyota the primary issuer — the
// worked example from the plan. Sector follows Toyota (Industrial); Industry
// collects Automotive from Toyota and Honda, Manufacturing from MHI.
export const JOINT_MOBILITY_RELEASE: PressRelease = {
  id: 2002,
  article_id: 'ACN-2002',
  company_ids: [91, 117, 82],
  primary_issuer_id: 91,

  headline: 'Toyota, Honda and Mitsubishi Heavy Industries Announce Joint Hydrogen Mobility Initiative',
  subheadline: 'Three-way programme targets commercial hydrogen refuelling infrastructure across Japan by 2030',
  summary: 'Toyota Motor Corporation, Honda Motor Co., Ltd. and Mitsubishi Heavy Industries, Ltd. have agreed to a joint programme to develop commercial hydrogen refuelling infrastructure in Japan.',
  body_html: '<p>TOKYO, August 5, 2026 - Toyota Motor Corporation, Honda Motor Co., Ltd. and Mitsubishi Heavy Industries, Ltd. today announced a joint initiative to develop commercial hydrogen refuelling infrastructure across Japan, with the first sites targeted for 2028 and nationwide coverage by 2030.</p><p>The programme brings together Toyota and Honda\'s fuel cell vehicle platforms with Mitsubishi Heavy Industries\' experience in large-scale energy infrastructure.</p>',
  dateline_overridden: false,
  custom_about_html: '<p>This release is issued jointly. Enquiries relating to fuel cell vehicle platforms should be directed to Toyota or Honda; enquiries relating to refuelling infrastructure should be directed to Mitsubishi Heavy Industries.</p>',

  published_at: '2026-08-05T02:00:00Z',
  status: 'published',

  sector_type: 'Industrial',
  industries: ['Automotive', 'Manufacturing'],
  topic: 'Partnership',
  classification_overridden: false,
  languages: ['EN'],
  secondary_languages: ['JA'],

  region: 'Japan',
  location: 'Tokyo, Japan',

  supplier: 'JCN Newswire',
  contacts: [
    { id: 1, name: 'Haruto Watanabe',  position: 'Global PR Manager',      email: 'h.watanabe@toyota.co.jp',      phone: '+81-565-28-2000' },
    { id: 2, name: 'Keiichi Nakamura', position: 'Global Communications',  email: 'keiichi.nakamura@honda.co.jp', phone: '+81-3-3423-1111' },
  ],
  translations: [
    { language: 'EN', url: 'https://www.acnnewswire.com/press-release/english/2002' },
    { language: 'JA', url: null },
  ],

  article_type: 'Press Release',
  tracking_id: 'JCN20260805-MOBILITY',
  distribute_to: 'Japan Wire',
  source: 'JCN Newswire',

  report_by: 'Shirley Chang',
  send_by: 'Bruce Porter',

  created_at: '2026-08-01T05:30:00Z',
  updated_at: '2026-08-05T02:00:00Z',
  updated_by_name: 'Shirley Chang',
}

// A draft mid-edit, and the override case: JCB is a Financial company, but this
// release was filed under Business by hand, so classification_overridden is true
// and the derivation leaves it alone.
export const JCB_DRAFT_RELEASE: PressRelease = {
  id: 2003,
  article_id: 'ACN-2003',
  company_ids: [199],
  primary_issuer_id: 199,

  headline: 'JCB to Host Payments Innovation Forum in Singapore',
  subheadline: null,
  summary: 'JCB Co., Ltd. will host a two-day forum on cross-border payment innovation in Singapore this November.',
  body_html: '<p>TOKYO, August 14, 2026 - JCB Co., Ltd. today announced it will host a two-day Payments Innovation Forum in Singapore in November, bringing together issuers, acquirers and fintech partners from across the region.</p>',
  dateline_overridden: true,
  custom_about_html: null,

  published_at: '2026-09-01T01:00:00Z',
  status: 'scheduled',

  // Filed under Business by hand rather than the derived Financial.
  sector_type: 'Business',
  industries: ['Trade Shows'],
  topic: 'Event',
  classification_overridden: true,
  languages: ['EN'],
  secondary_languages: ['JA'],

  region: 'ASEAN',
  location: 'Singapore',

  supplier: 'JCN Newswire',
  contacts: [
    { id: 1, name: 'JCB PR Team', position: 'Public Relations', email: 'pr@jcb.co.jp', phone: '+81-3-5778-8111' },
  ],
  translations: [{ language: 'EN', url: null }],

  article_type: 'Event Notice',
  tracking_id: null,
  distribute_to: 'Asia Wire',
  source: 'JCN Newswire',

  report_by: 'Bruce Porter',
  send_by: null,

  created_at: '2026-08-14T07:00:00Z',
  updated_at: '2026-08-14T07:00:00Z',
  updated_by_name: 'Bruce Porter',
}

export const ALL_SEED_ARTICLES: PressRelease[] = [
  DATAVAULT_RELEASE,      // id: 2001 — single company, derived
  JOINT_MOBILITY_RELEASE, // id: 2002 — three companies, one issuer; the worked example
  JCB_DRAFT_RELEASE,      // id: 2003 — scheduled, classification overridden
]
