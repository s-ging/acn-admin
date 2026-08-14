// src/lib/languages.ts
// Language tagging for a company.
//
// A language is in one of three states, stored across two arrays on the company:
//
//   primary   — in `languages`            — green dot
//   secondary — in `secondary_languages`  — black dot
//   none      — in neither                — empty dot
//
// Two invariants, both enforced by setLanguageState and repaired on load by
// normalizeLanguageTags:
//
//   1. The arrays don't overlap — a language is never in both.
//   2. A company has at most one main language, so `languages` holds 0 or 1
//      entries. Naming a new main language demotes the previous one to
//      secondary rather than dropping it: the company still publishes in it.

import type { LanguageCode } from '../types/company.types'

export type LanguageState = 'primary' | 'secondary' | 'none'

export interface LanguageTags {
  languages: LanguageCode[]
  // Optional on read: records saved before this field existed don't have it.
  // Always written back, so anything that round-trips gains it.
  secondary_languages?: LanguageCode[]
}

export interface LanguageTagsPatch {
  languages: LanguageCode[]
  secondary_languages: LanguageCode[]
}

export const LANGUAGES: { code: LanguageCode; label: string; name: string }[] = [
  { code: 'EN', label: 'EN', name: 'English' },
  { code: 'ZH-HANS', label: 'ZH-HANS', name: 'Chinese (Simplified)' },
  { code: 'ZH-HANT', label: 'ZH-HANT', name: 'Chinese (Traditional)' },
  { code: 'JA', label: 'JA', name: 'Japanese' },
  { code: 'KO', label: 'KO', name: 'Korean' },
]

export const LANGUAGE_NAMES: Record<LanguageCode, string> = Object.fromEntries(
  LANGUAGES.map(l => [l.code, l.name])
) as Record<LanguageCode, string>

// The single source of truth for what each dot means. The tooltip, the
// right-click menu and any legend all read from here, so they can't drift apart.
export const LANGUAGE_STATES: {
  state: LanguageState
  label: string
  description: string
}[] = [
  {
    state: 'primary',
    label: 'Main language',
    description:
      'Releases are issued in this language as standard. Only one language can be the main one — the current main language becomes "also published".',
  },
  {
    state: 'secondary',
    label: 'Also published',
    description: 'Releases are issued in this language, but less often than the main language.',
  },
  {
    state: 'none',
    label: 'Not used',
    description: 'No releases are issued in this language.',
  },
]

export const LANGUAGE_STATE_INFO = Object.fromEntries(
  LANGUAGE_STATES.map(s => [s.state, s])
) as Record<LanguageState, (typeof LANGUAGE_STATES)[number]>

export function getLanguageState(tags: LanguageTags, code: LanguageCode): LanguageState {
  if (tags.languages.includes(code)) return 'primary'
  if ((tags.secondary_languages ?? []).includes(code)) return 'secondary'
  return 'none'
}

// Left-click order, matching the dot getting "stronger": empty → black → green.
export function nextLanguageState(current: LanguageState): LanguageState {
  if (current === 'none') return 'secondary'
  if (current === 'secondary') return 'primary'
  return 'none'
}

const ORDER = LANGUAGES.map(l => l.code)
const sortByOrder = (codes: LanguageCode[]) =>
  [...codes].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))

/**
 * Returns the patch that puts `code` into `state`, preserving the display order
 * and holding both invariants: the arrays never overlap, and at most one
 * language is main. Naming a new main language demotes the previous one to
 * secondary.
 */
export function setLanguageState(
  tags: LanguageTags,
  code: LanguageCode,
  state: LanguageState
): LanguageTagsPatch {
  const wasPrimary = tags.languages.filter(l => l !== code)
  const secondary = (tags.secondary_languages ?? []).filter(l => l !== code)

  if (state === 'primary') {
    // Whatever was main becomes "also published" — the company still issues
    // releases in it, it just isn't the standard language any more.
    return {
      languages: [code],
      secondary_languages: sortByOrder([...secondary, ...wasPrimary]),
    }
  }

  if (state === 'secondary') secondary.push(code)

  return {
    languages: sortByOrder(wasPrimary),
    secondary_languages: sortByOrder(secondary),
  }
}

/**
 * Repairs tags read from storage or JSON import: drops overlap between the two
 * lists and collapses multiple main languages down to the first, demoting the
 * rest to secondary. Records written before the single-main rule existed can
 * carry several.
 */
export function normalizeLanguageTags(tags: LanguageTags): LanguageTagsPatch {
  const primaries = tags.languages ?? []
  const main = primaries[0]
  const demoted = primaries.slice(1)
  const secondary = (tags.secondary_languages ?? []).filter(l => l !== main)

  return {
    languages: main ? [main] : [],
    secondary_languages: sortByOrder([...new Set([...secondary, ...demoted])]),
  }
}

// The hover tooltip: what this language is currently tagged as, and what it means.
export function describeLanguage(code: LanguageCode, state: LanguageState): string {
  const info = LANGUAGE_STATE_INFO[state]
  return `${LANGUAGE_NAMES[code]} — ${info.label}\n${info.description}\n\nClick to cycle, right-click to choose.`
}
