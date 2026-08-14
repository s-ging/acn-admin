import { describe, it, expect } from 'vitest'
import {
  LANGUAGES,
  LANGUAGE_STATES,
  LANGUAGE_STATE_INFO,
  getLanguageState,
  nextLanguageState,
  setLanguageState,
  normalizeLanguageTags,
  describeLanguage,
} from './languages'
import type { LanguageState, LanguageTags, LanguageTagsPatch } from './languages'
import type { LanguageCode } from '../types/company.types'

const empty: LanguageTags = { languages: [], secondary_languages: [] }
const ALL_STATES: LanguageState[] = ['primary', 'secondary', 'none']

describe('language state metadata', () => {
  it('describes all three states', () => {
    expect(LANGUAGE_STATES.map(s => s.state).sort()).toEqual([...ALL_STATES].sort())
  })

  it('gives every state a label and a non-empty description', () => {
    for (const state of ALL_STATES) {
      expect(LANGUAGE_STATE_INFO[state].label).toBeTruthy()
      expect(LANGUAGE_STATE_INFO[state].description.length).toBeGreaterThan(10)
    }
  })

  it('names every language in the LanguageCode union', () => {
    // Fails if a code is added to the type but not to the display list.
    const codes: LanguageCode[] = ['EN', 'ZH-HANS', 'ZH-HANT', 'JA', 'KO']
    expect(LANGUAGES.map(l => l.code).sort()).toEqual([...codes].sort())
    for (const l of LANGUAGES) expect(l.name).toBeTruthy()
  })

  it('puts the language and its current meaning in the tooltip', () => {
    const tip = describeLanguage('JA', 'secondary')
    expect(tip).toContain('Japanese')
    expect(tip).toContain(LANGUAGE_STATE_INFO.secondary.label)
    expect(tip).toContain(LANGUAGE_STATE_INFO.secondary.description)
  })
})

describe('getLanguageState', () => {
  it('reads primary, secondary and none off the two arrays', () => {
    const tags: LanguageTags = { languages: ['EN'], secondary_languages: ['JA'] }
    expect(getLanguageState(tags, 'EN')).toBe('primary')
    expect(getLanguageState(tags, 'JA')).toBe('secondary')
    expect(getLanguageState(tags, 'KO')).toBe('none')
  })
})

describe('records saved before secondary_languages existed', () => {
  // localStorage and JSON import both cast straight to CompanyFull, so a record
  // written before this field existed arrives with it undefined at runtime.
  const legacy = { languages: ['EN', 'JA'] } as LanguageTags

  it('reads without throwing', () => {
    expect(getLanguageState(legacy, 'EN')).toBe('primary')
    expect(getLanguageState(legacy, 'KO')).toBe('none')
  })

  it('gains the field on the first write', () => {
    const result = setLanguageState(legacy, 'KO', 'secondary')
    expect(result.secondary_languages).toEqual(['KO'])
    expect(result.languages).toEqual(['EN', 'JA'])
  })
})

describe('nextLanguageState', () => {
  it('cycles none → secondary → primary → none', () => {
    expect(nextLanguageState('none')).toBe('secondary')
    expect(nextLanguageState('secondary')).toBe('primary')
    expect(nextLanguageState('primary')).toBe('none')
  })

  it('returns to the starting state after three clicks, for every state', () => {
    for (const state of ALL_STATES) {
      expect(nextLanguageState(nextLanguageState(nextLanguageState(state)))).toBe(state)
    }
  })
})

describe('setLanguageState', () => {
  it('moves a language between states without leaving it in both arrays', () => {
    // The bug this guards: primary and secondary are separate lists, so a
    // careless write can tag one language as both at once.
    let tags: LanguageTagsPatch = { languages: [], secondary_languages: [] }
    for (const state of [...ALL_STATES, ...ALL_STATES, 'primary' as const]) {
      tags = setLanguageState(tags, 'EN', state)
      const inBoth = tags.languages.filter(l => tags.secondary_languages.includes(l))
      expect(inBoth, `after setting ${state}`).toEqual([])
      expect(getLanguageState(tags, 'EN')).toBe(state)
    }
  })

  it('allows only one main language, demoting the previous one', () => {
    const tags = setLanguageState({ languages: ['EN'], secondary_languages: [] }, 'JA', 'primary')
    expect(tags.languages).toEqual(['JA'])
    expect(tags.secondary_languages).toEqual(['EN'])
  })

  it('keeps the demoted language rather than dropping it', () => {
    // EN is main and ZH-HANS is already secondary; naming JA main must not lose
    // either of the other two.
    const tags = setLanguageState(
      { languages: ['EN'], secondary_languages: ['ZH-HANS'] },
      'JA',
      'primary'
    )
    expect(tags.languages).toEqual(['JA'])
    expect(tags.secondary_languages).toEqual(['EN', 'ZH-HANS'])
  })

  it('promoting a language that is already secondary does not duplicate it', () => {
    const tags = setLanguageState(
      { languages: ['EN'], secondary_languages: ['JA'] },
      'JA',
      'primary'
    )
    expect(tags.languages).toEqual(['JA'])
    expect(tags.secondary_languages).toEqual(['EN'])
  })

  it('re-selecting the current main language is a no-op', () => {
    const tags = setLanguageState(
      { languages: ['EN'], secondary_languages: ['JA'] },
      'EN',
      'primary'
    )
    expect(tags.languages).toEqual(['EN'])
    expect(tags.secondary_languages).toEqual(['JA'])
  })

  it('never leaves more than one main language, whatever the sequence', () => {
    let tags: LanguageTagsPatch = { languages: [], secondary_languages: [] }
    for (const { code } of LANGUAGES) {
      for (const state of ALL_STATES) {
        tags = setLanguageState(tags, code, state)
        expect(tags.languages.length, `${code} → ${state}`).toBeLessThanOrEqual(1)
        expect(tags.languages.filter(l => tags.secondary_languages.includes(l))).toEqual([])
      }
    }
  })
})

describe('normalizeLanguageTags', () => {
  it('collapses a record with several main languages, keeping the first', () => {
    const tags = normalizeLanguageTags({
      languages: ['EN', 'JA', 'ZH-HANS'],
      secondary_languages: [],
    })
    expect(tags.languages).toEqual(['EN'])
    expect(tags.secondary_languages).toEqual(['ZH-HANS', 'JA'].sort(
      (a, b) => LANGUAGES.findIndex(l => l.code === a) - LANGUAGES.findIndex(l => l.code === b)
    ))
  })

  it('drops overlap between the two lists', () => {
    const tags = normalizeLanguageTags({ languages: ['EN'], secondary_languages: ['EN', 'JA'] })
    expect(tags.languages).toEqual(['EN'])
    expect(tags.secondary_languages).toEqual(['JA'])
  })

  it('handles a record with no languages at all', () => {
    expect(normalizeLanguageTags({ languages: [] })).toEqual({
      languages: [],
      secondary_languages: [],
    })
  })

  it('leaves an already-valid record unchanged', () => {
    const valid = { languages: ['JA' as const], secondary_languages: ['EN' as const] }
    expect(normalizeLanguageTags(valid)).toEqual(valid)
  })

  it('is idempotent', () => {
    const messy = { languages: ['EN' as const, 'JA' as const], secondary_languages: ['JA' as const] }
    const once = normalizeLanguageTags(messy)
    expect(normalizeLanguageTags(once)).toEqual(once)
  })
})

describe('setLanguageState (shared behaviour)', () => {
  it('is idempotent — setting the same state twice adds no duplicate', () => {
    const once = setLanguageState(empty, 'JA', 'secondary')
    const twice = setLanguageState(once, 'JA', 'secondary')
    expect(twice.secondary_languages).toEqual(['JA'])
    expect(twice.languages).toEqual([])
  })

  it('leaves languages other than the demoted main one untouched', () => {
    const tags: LanguageTags = { languages: ['EN'], secondary_languages: ['KO'] }
    const result = setLanguageState(tags, 'JA', 'primary')
    expect(result.languages).toEqual(['JA'])
    // KO was already secondary and stays; EN is demoted, not dropped.
    expect(result.secondary_languages).toEqual(['EN', 'KO'])
  })

  it('keeps the secondary list in the declared display order', () => {
    let tags = setLanguageState(empty, 'KO', 'secondary')
    tags = setLanguageState(tags, 'JA', 'secondary')
    tags = setLanguageState(tags, 'EN', 'secondary')
    expect(tags.secondary_languages).toEqual(['EN', 'JA', 'KO'])
  })

  it('does not mutate the tags it was given', () => {
    const tags: LanguageTags = { languages: ['EN'], secondary_languages: [] }
    setLanguageState(tags, 'EN', 'none')
    expect(tags.languages).toEqual(['EN'])
  })

  it('survives every state transition for every language', () => {
    for (const { code } of LANGUAGES) {
      for (const from of ALL_STATES) {
        for (const to of ALL_STATES) {
          const start = setLanguageState(empty, code, from)
          const end = setLanguageState(start, code, to)
          expect(getLanguageState(end, code), `${code}: ${from} → ${to}`).toBe(to)
          expect(end.languages.filter(l => end.secondary_languages.includes(l))).toEqual([])
        }
      }
    }
  })

  it('clicking through the cycle five times lands where it started', () => {
    let tags: LanguageTags = { languages: ['EN'], secondary_languages: ['JA'] }
    const start = JSON.stringify(tags)
    for (let i = 0; i < 3; i++) {
      tags = setLanguageState(tags, 'EN', nextLanguageState(getLanguageState(tags, 'EN')))
    }
    expect(JSON.stringify(tags)).toBe(start)
  })
})
