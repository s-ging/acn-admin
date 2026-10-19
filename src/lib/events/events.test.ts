/**
 * jsdom for `submitEventDraft`, which keeps its fallback copy in localStorage.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { eventStatus, formatEventDates, formatReleaseDate, readEventDate } from './format'
import { loadPendingEvent } from './storage'
import {
  blankEventDraft,
  changedFields,
  draftFromEvent,
  eventDraftPayload,
  submitEventDraft,
  validateEventDraft,
  type EventDraft,
} from './write'
import type { Event } from '../../types/event.types'

function event(over: Partial<Event> = {}): Event {
  return {
    id: 163,
    startDate: '2009-07-16T00:00:00+08:00',
    endDate: '2009-07-17T23:59:59+08:00',
    description: '3rd Asian Publishing Convention',
    location: 'Manila',
    url: 'https://www.publishingconvention.com',
    pressReleaseUrl: null,
    photo: 'https://www.acnnewswire.com/eventimages/ap10.jpg',
    compId: 714,
    companies: [],
    ...over,
  }
}

describe('readEventDate', () => {
  it('reads the calendar date out of the string, not via a Date', () => {
    // Going through Date would re-read the instant in the local zone and could
    // hand back the previous day — the exact bug the +08:00 exists to prevent.
    expect(readEventDate('2009-07-16T00:00:00+08:00')).toEqual({ year: 2009, month: 7, day: 16 })
  })

  it('is null for anything unreadable', () => {
    expect(readEventDate('')).toBeNull()
    expect(readEventDate(null)).toBeNull()
  })
})

describe('formatEventDates', () => {
  it('collapses a single-day event to one date', () => {
    expect(
      formatEventDates(event({ startDate: '2009-07-16T00:00:00+08:00', endDate: '2009-07-16T23:59:59+08:00' }))
    ).toBe('16 Jul 2009')
  })

  it('collapses a range within one month', () => {
    expect(formatEventDates(event())).toBe('16–17 Jul 2009')
  })

  it('keeps both months when a range crosses one', () => {
    expect(
      formatEventDates(event({ startDate: '2007-11-28T00:00:00+08:00', endDate: '2007-12-13T23:59:59+08:00' }))
    ).toBe('28 Nov – 13 Dec 2007')
  })

  it('keeps both years when a range crosses one', () => {
    expect(
      formatEventDates(event({ startDate: '2007-12-28T00:00:00+08:00', endDate: '2008-01-03T23:59:59+08:00' }))
    ).toBe('28 Dec 2007 – 3 Jan 2008')
  })

  it('shows a dash rather than "Invalid Date" for a dateless event', () => {
    expect(formatEventDates(event({ startDate: '', endDate: '' }))).toBe('—')
  })
})

describe('eventStatus', () => {
  const during = Date.parse('2009-07-17T10:00:00+08:00')

  it('reads an event as running on its final day', () => {
    // This is what the 23:59:59 end stamp buys: at 10am on the 17th, an event
    // ending "the 17th" is still on.
    expect(eventStatus(event(), during)).toBe('running')
  })

  it('reads before and after correctly', () => {
    expect(eventStatus(event(), Date.parse('2009-07-01T00:00:00+08:00'))).toBe('upcoming')
    expect(eventStatus(event(), Date.parse('2009-08-01T00:00:00+08:00'))).toBe('past')
  })

  it('treats a dateless event as past, keeping it out of "upcoming"', () => {
    expect(eventStatus(event({ startDate: '', endDate: '' }), during)).toBe('past')
  })
})

describe('formatReleaseDate', () => {
  it('shows the clock time these carry, unlike event dates', () => {
    expect(formatReleaseDate('2009-07-24T17:36:15')).toBe('24 Jul 2009 17:36')
  })

  it('copes with a date and no time', () => {
    expect(formatReleaseDate('2009-07-24')).toBe('24 Jul 2009')
    expect(formatReleaseDate(null)).toBe('—')
  })
})

describe('draftFromEvent', () => {
  it('reduces the read model to what is actually editable', () => {
    const draft = draftFromEvent(event(), true)
    // Dates come back as <input type="date"> wants them.
    expect(draft.startDate).toBe('2009-07-16')
    expect(draft.endDate).toBe('2009-07-17')
    // The photo goes back to the bare filename the wire stores.
    expect(draft.eventImage).toBe('ap10.jpg')
    expect(draft.compId).toBe(714)
    expect(draft.publish).toBe(true)
  })

  it('handles an event with no photo', () => {
    expect(draftFromEvent(event({ photo: null }), false).eventImage).toBe('')
  })
})

describe('validateEventDraft', () => {
  const valid = (): EventDraft => draftFromEvent(event(), true)

  it('passes a draft built from a real event', () => {
    expect(validateEventDraft(valid())).toEqual([])
  })

  it('requires a name and both dates', () => {
    const fields = validateEventDraft({ ...blankEventDraft() }).map(e => e.field)
    expect(fields).toContain('description')
    expect(fields).toContain('startDate')
    expect(fields).toContain('endDate')
  })

  it('rejects an end date before the start', () => {
    const errors = validateEventDraft({ ...valid(), endDate: '2009-07-01' })
    expect(errors.map(e => e.field)).toEqual(['endDate'])
  })

  it('accepts a range that starts and ends the same day', () => {
    expect(validateEventDraft({ ...valid(), endDate: valid().startDate })).toEqual([])
  })

  it('rejects a path in the image field, which takes a filename', () => {
    const errors = validateEventDraft({ ...valid(), eventImage: '/eventimages/ap10.jpg' })
    expect(errors.map(e => e.field)).toEqual(['eventImage'])
  })

  it('does not require an organiser, a location or an image', () => {
    // 718 of 839 events have no organiser and 16 have no image — requiring any
    // of these would make most of the real data invalid.
    const sparse = { ...valid(), compId: null, location: '', url: '', eventImage: '' }
    expect(validateEventDraft(sparse)).toEqual([])
  })

  it('rejects a nonsense organiser id but allows blank', () => {
    expect(validateEventDraft({ ...valid(), compId: -1 }).map(e => e.field)).toEqual(['compId'])
    expect(validateEventDraft({ ...valid(), compId: null })).toEqual([])
  })
})

describe('changedFields', () => {
  it('reports nothing for an untouched draft', () => {
    const draft = draftFromEvent(event(), true)
    expect(changedFields(draft, draft)).toEqual([])
  })

  it('names only what moved', () => {
    const before = draftFromEvent(event(), true)
    const after = { ...before, location: 'Singapore', publish: false }
    expect(changedFields(before, after).sort()).toEqual(['location', 'publish'])
  })
})

describe('eventDraftPayload', () => {
  it('sends the /full field names, with date-only dates and a bare url', () => {
    expect(eventDraftPayload(draftFromEvent(event(), true))).toEqual({
      name: '3rd Asian Publishing Convention',
      // The +08:00 and 23:59:59 are read-side repairs; sending them back would
      // change what is stored.
      startDate: '2009-07-16',
      endDate: '2009-07-17',
      location: 'Manila',
      url: 'www.publishingconvention.com',
      eventImage: 'ap10.jpg',
      isPublished: true,
      organiserId: 714,
    })
  })
})

describe('submitEventDraft', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('reports invalid without sending or storing anything', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const result = await submitEventDraft(blankEventDraft())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
    expect(fetch).not.toHaveBeenCalled()
    expect(loadPendingEvent(null)).toBeNull()
  })

  it('keeps the draft locally when the API cannot be reached, and clears it once a send succeeds', async () => {
    const draft = { ...draftFromEvent(event(), true), location: 'Singapore' }

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    const failed = await submitEventDraft(draft)
    expect(failed.ok).toBe(false)
    if (!failed.ok) expect(failed.reason).toBe('local')
    expect(loadPendingEvent(163)).toEqual(draft)

    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })))
    expect(await submitEventDraft(draft)).toEqual({ ok: true, id: 163 })
    expect(loadPendingEvent(163)).toBeNull()
  })
})
