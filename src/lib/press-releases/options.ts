// src/lib/press-releases/options.ts
// The picklists behind the sidebar selects.
//
// Placeholder master lists for the scaffold: they are the values the wire uses
// today, but none of them are wired to a backing table yet. When one gains a
// table it moves out of here, the way sectors did into lib/sectors.ts.

import type { ArticleStatus } from '../../types/press-release.types'

export const ARTICLE_STATUSES: { value: ArticleStatus; label: string }[] = [
  { value: 'draft',     label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived',  label: 'Archived' },
]

export const TOPICS = [
  'Earnings',
  'Product Launch',
  'Partnership',
  'Merger & Acquisition',
  'Award',
  'Event',
  'Executive Appointment',
  'Research',
  'Corporate Update',
]

export const REGIONS = [
  'Asia',
  'ASEAN',
  'Greater China',
  'Japan',
  'Korea',
  'South Asia',
  'Oceania',
  'Europe',
  'Middle East',
  'North America',
  'Latin America',
  'Africa',
  'Global',
]

export const SUPPLIERS = [
  'ACN Newswire',
  'JCN Newswire',
  'Direct',
  'Partner Agency',
]

export const ARTICLE_TYPES = [
  'Press Release',
  'Media Advisory',
  'Financial Results',
  'Photo Release',
  'Event Notice',
]

export const DISTRIBUTION_TARGETS = [
  'Full Wire',
  'Asia Wire',
  'Japan Wire',
  'Greater China Wire',
  'Financial Media',
  'Trade Media Only',
  'Website Only',
]

export const SOURCES = [
  'ACN Newswire',
  'JCN Newswire',
  'Company Direct',
]
