import { describe, it, expect } from 'vitest'
import { parseDateline, applyDateline, composeDateline, applyAutoDateline } from './dateline'
import { createArticle } from './normalize'
import type { PressRelease } from '../../types/press-release.types'

const BODY = '<p>TOKYO, August 14, 2020 - Toyota said today.</p><p>Second paragraph.</p>'

// Written without a Z so it parses as local time, which is what the composer
// reads and what <DateTimeField> displays. Keeps the expected day stable
// wherever the suite runs.
const AUG_14 = '2020-08-14T09:00'

function article(patch: Partial<PressRelease> = {}): PressRelease {
  return { ...createArticle(2001, '2020-08-14T09:00:00Z'), ...patch }
}

describe('parseDateline', () => {
  it('reads the dateline off the first paragraph', () => {
    expect(parseDateline(BODY)).toBe('TOKYO, August 14, 2020')
  })

  it('accepts en and em dashes as the separator', () => {
    expect(parseDateline('<p>TOKYO, August 14, 2020 – Toyota said.</p>')).toBe('TOKYO, August 14, 2020')
    expect(parseDateline('<p>TOKYO, August 14, 2020 — Toyota said.</p>')).toBe('TOKYO, August 14, 2020')
  })

  it('accepts a city with no date', () => {
    expect(parseDateline('<p>TOKYO - Toyota said.</p>')).toBe('TOKYO')
  })

  it('accepts a multi-word capitalised city', () => {
    expect(parseDateline('<p>HONG KONG, May 1, 2026 - HKTDC said.</p>')).toBe('HONG KONG, May 1, 2026')
  })

  it('keeps hyphenated place names intact', () => {
    expect(parseDateline('<p>WINSTON-SALEM, June 2, 2026 - The company said.</p>'))
      .toBe('WINSTON-SALEM, June 2, 2026')
  })

  it('returns null when there is no dateline', () => {
    expect(parseDateline('<p>Toyota said today that it would.</p>')).toBeNull()
    expect(parseDateline(null)).toBeNull()
    expect(parseDateline('')).toBeNull()
  })

  // The rule that stops the parse from eating someone's prose.
  it('does not mistake a parenthetical dash for a dateline', () => {
    expect(parseDateline('<p>The company - which was founded in 1990 - said today.</p>')).toBeNull()
  })

  it('ignores a dash that follows markup', () => {
    expect(parseDateline('<p><strong>TOKYO</strong> - Toyota said.</p>')).toBeNull()
  })

  it('ignores an opening that is too long to be a dateline', () => {
    const long = 'A'.repeat(90)
    expect(parseDateline(`<p>${long} - and then some text.</p>`)).toBeNull()
  })

  it('decodes entities in the dateline', () => {
    expect(parseDateline('<p>SAINT-DENIS &amp; PARIS, May 1, 2026 - The group said.</p>'))
      .toBe('SAINT-DENIS & PARIS, May 1, 2026')
  })
})

describe('applyDateline', () => {
  it('replaces an existing dateline and leaves the rest alone', () => {
    const next = applyDateline(BODY, 'OSAKA, September 1, 2026')
    expect(next).toBe('<p>OSAKA, September 1, 2026 - Toyota said today.</p><p>Second paragraph.</p>')
  })

  it('prepends one when the body has none', () => {
    expect(applyDateline('<p>Toyota said today.</p>', 'TOKYO, August 14, 2020'))
      .toBe('<p>TOKYO, August 14, 2020 - Toyota said today.</p>')
  })

  it('removes the dateline when given an empty string', () => {
    expect(applyDateline(BODY, '')).toBe('<p>Toyota said today.</p><p>Second paragraph.</p>')
  })

  it('starts a body when there is none at all', () => {
    expect(applyDateline(null, 'TOKYO, August 14, 2020')).toBe('<p>TOKYO, August 14, 2020 - </p>')
    expect(applyDateline('', 'TOKYO')).toBe('<p>TOKYO - </p>')
  })

  it('does nothing when there is neither a body nor a dateline', () => {
    expect(applyDateline(null, '')).toBeNull()
  })

  it('leaves prose containing a dash untouched apart from the prepend', () => {
    const prose = '<p>The company - which was founded in 1990 - said today.</p>'
    expect(applyDateline(prose, 'TOKYO'))
      .toBe('<p>TOKYO - The company - which was founded in 1990 - said today.</p>')
  })

  it('preserves paragraph attributes such as alignment', () => {
    const aligned = '<p style="text-align: center">TOKYO - Toyota said.</p>'
    expect(applyDateline(aligned, 'OSAKA'))
      .toBe('<p style="text-align: center">OSAKA - Toyota said.</p>')
  })

  it('escapes markup typed into the dateline', () => {
    expect(applyDateline('<p>Toyota said.</p>', 'TOKYO <script>'))
      .toBe('<p>TOKYO &lt;script&gt; - Toyota said.</p>')
  })

  it('round-trips', () => {
    const applied = applyDateline('<p>Toyota said.</p>', 'TOKYO, August 14, 2020')
    expect(parseDateline(applied)).toBe('TOKYO, August 14, 2020')
  })
})

describe('composeDateline', () => {
  it('builds one from the location and the publication date', () => {
    expect(composeDateline('Tokyo, Japan', AUG_14)).toBe('TOKYO, August 14, 2020')
  })

  it('takes the city from the first segment of the location', () => {
    expect(composeDateline('Beaverton, Oregon', AUG_14)).toBe('BEAVERTON, August 14, 2020')
    expect(composeDateline('Singapore', AUG_14)).toBe('SINGAPORE, August 14, 2020')
  })

  it('falls back to the city alone when there is no date', () => {
    expect(composeDateline('Tokyo, Japan', null)).toBe('TOKYO')
    expect(composeDateline('Tokyo, Japan', 'not a date')).toBe('TOKYO')
  })

  it('composes nothing without a location — a dateline needs a place', () => {
    expect(composeDateline(null, AUG_14)).toBeNull()
    expect(composeDateline('', AUG_14)).toBeNull()
    expect(composeDateline('   ', AUG_14)).toBeNull()
  })

  it('produces something the parser recognises', () => {
    const composed = composeDateline('Tokyo, Japan', AUG_14)!
    expect(parseDateline(applyDateline('<p>Toyota said.</p>', composed))).toBe(composed)
  })
})

describe('applyAutoDateline', () => {
  it('fills in a body that has no dateline', () => {
    const patch = applyAutoDateline(article({
      location: 'Tokyo, Japan',
      published_at: AUG_14,
      body_html: '<p>Toyota said today.</p>',
    }))
    expect(patch.body_html).toBe('<p>TOKYO, August 14, 2020 - Toyota said today.</p>')
  })

  it('recomposes when the location moves on', () => {
    const patch = applyAutoDateline(article({
      location: 'Osaka, Japan',
      published_at: AUG_14,
      body_html: '<p>TOKYO, August 14, 2020 - Toyota said today.</p>',
    }))
    expect(patch.body_html).toBe('<p>OSAKA, August 14, 2020 - Toyota said today.</p>')
  })

  it('recomposes when the release is rescheduled', () => {
    const patch = applyAutoDateline(article({
      location: 'Tokyo, Japan',
      published_at: '2020-09-01T09:00',
      body_html: '<p>TOKYO, August 14, 2020 - Toyota said today.</p>',
    }))
    expect(patch.body_html).toBe('<p>TOKYO, September 1, 2020 - Toyota said today.</p>')
  })

  // The whole point of the flag.
  it('never touches a dateline written by hand', () => {
    const patch = applyAutoDateline(article({
      location: 'Osaka, Japan',
      published_at: AUG_14,
      body_html: '<p>TOKYO HQ - Toyota said today.</p>',
      dateline_overridden: true,
    }))
    expect(patch).toEqual({})
  })

  it('does nothing without a location', () => {
    expect(applyAutoDateline(article({
      location: null,
      published_at: AUG_14,
      body_html: '<p>Toyota said today.</p>',
    }))).toEqual({})
  })

  it('returns an empty patch when the dateline already matches', () => {
    expect(applyAutoDateline(article({
      location: 'Tokyo, Japan',
      published_at: AUG_14,
      body_html: '<p>TOKYO, August 14, 2020 - Toyota said today.</p>',
    }))).toEqual({})
  })

  it('starts a body when the release has none yet', () => {
    const patch = applyAutoDateline(article({
      location: 'Tokyo, Japan',
      published_at: AUG_14,
      body_html: null,
    }))
    expect(patch.body_html).toBe('<p>TOKYO, August 14, 2020 - </p>')
  })

  it('leaves the rest of the release alone', () => {
    const patch = applyAutoDateline(article({
      location: 'Tokyo, Japan',
      published_at: AUG_14,
      body_html: '<p>Toyota said today.</p><p>A second paragraph - with a dash.</p>',
    }))
    expect(patch.body_html).toContain('<p>A second paragraph - with a dash.</p>')
  })
})
