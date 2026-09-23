import { describe, it, expect } from 'vitest'
import {
  canHaveReleases,
  eventYear,
  isPublished,
  mapEvent,
  mapEventCompany,
  mapEventFull,
  mapEventRelease,
  toAbsoluteUrl,
  toEventIso,
} from './map-event'
import type { ApiArticleCompany, ApiEvent, ApiEventFull } from './types'

// The fixtures are real responses from development.acnnewswire.com, trimmed but
// not reshaped — event 163, the one the published contract uses as its example.

function apiCompany(over: Partial<ApiArticleCompany> = {}): ApiArticleCompany {
  return {
    companyID: 714,
    companyName: 'Asian Publishing Convention',
    companyNameCH: '', companyNameCT: '', companyNameJP: '', companyNameKO: '',
    companyURL: 'publishingconvention.com',
    logoFileName: 'AP10.gif',
    topLogoFileName: '',
    sectorName: null,
    ...over,
  }
}

/** `GET /api/Events` — event 163. */
const EVENT: ApiEvent = {
  id: 163,
  startDate: '2009-07-16T00:00:00',
  endDate: '2009-07-17T00:00:00',
  description: '3rd Asian Publishing Convention',
  location: 'Manila',
  url: 'www.publishingconvention.com',
  inUrl: '/events.asp?compid=714&yr=2009&page_num=1',
  eventImage: 'ap10.jpg',
  lid: '2',
  publish: 'y',
  compId: 714,
  companies: [apiCompany()],
}

describe('toEventIso', () => {
  it('stamps the wire’s +08:00 offset onto an offsetless date', () => {
    // Without this the browser reads midnight in the *viewer's* zone, and an
    // event on the 16th renders as the 15th anywhere west of the wire.
    expect(toEventIso('2009-07-16T00:00:00')).toBe('2009-07-16T00:00:00+08:00')
  })

  it('pushes an end date to the last second of its day', () => {
    // The wire gives the final day at midnight, which would read as already
    // finished for the whole of that day.
    expect(toEventIso('2009-07-17T00:00:00', true)).toBe('2009-07-17T23:59:59+08:00')
  })

  it('takes the calendar date as written, ignoring any time the wire sends', () => {
    expect(toEventIso('2009-07-16T18:30:00')).toBe('2009-07-16T00:00:00+08:00')
  })

  it('returns null rather than an Invalid Date for junk', () => {
    expect(toEventIso(null)).toBeNull()
    expect(toEventIso('')).toBeNull()
    expect(toEventIso('not a date')).toBeNull()
    // A date the wire mangled must not be passed through.
    expect(toEventIso('2009-13-45T00:00:00')).toBeNull()
  })
})

describe('toAbsoluteUrl', () => {
  it('adds https:// to the bare hostnames the wire stores', () => {
    // Left bare, `href="www.x.com"` is a RELATIVE path — it would navigate to
    // /events/www.x.com.
    expect(toAbsoluteUrl('www.publishingconvention.com')).toBe('https://www.publishingconvention.com')
  })

  it('leaves an already-absolute URL alone, including http', () => {
    expect(toAbsoluteUrl('https://example.com')).toBe('https://example.com')
    // Not upgraded to https. Event 507 is the only http record in the set and
    // its host does not answer on https — see the note in map-event.ts.
    expect(toAbsoluteUrl('http://www.battery-expo.com')).toBe('http://www.battery-expo.com')
  })

  it('strips a leading slash before prefixing', () => {
    // Two events store their URL this way (#518, #1016).
    expect(toAbsoluteUrl('/indonesia.dccisummit.com')).toBe('https://indonesia.dccisummit.com')
  })

  it('returns null for blanks and for values that are not hosts', () => {
    expect(toAbsoluteUrl(null)).toBeNull()
    expect(toAbsoluteUrl('  ')).toBeNull()
    expect(toAbsoluteUrl('/')).toBeNull()
    expect(toAbsoluteUrl('---')).toBeNull()
  })
})

describe('mapEvent', () => {
  it('maps the contract fields off a real row', () => {
    const event = mapEvent(EVENT)
    expect(event.id).toBe(163)
    expect(event.description).toBe('3rd Asian Publishing Convention')
    expect(event.location).toBe('Manila')
    expect(event.startDate).toBe('2009-07-16T00:00:00+08:00')
    expect(event.endDate).toBe('2009-07-17T23:59:59+08:00')
    expect(event.url).toBe('https://www.publishingconvention.com')
    expect(event.compId).toBe(714)
  })

  it('resolves the event image onto /eventimages/, not /images/', () => {
    // Its own top-level path, unlike the company logos.
    expect(mapEvent(EVENT).photo).toBe('https://www.acnnewswire.com/eventimages/ap10.jpg')
  })

  it('always leaves pressReleaseUrl null, as the contract specifies', () => {
    expect(mapEvent(EVENT).pressReleaseUrl).toBeNull()
  })

  it('collapses the organiser the wire repeats once per release', () => {
    // The worst real event carries 168 identical copies of one company.
    const repeated = { ...EVENT, companies: Array.from({ length: 168 }, () => apiCompany()) }
    const event = mapEvent(repeated)
    expect(event.companies).toHaveLength(1)
    expect(event.companies[0].id).toBe(714)
  })

  it('keeps distinct companies, in the order the wire sent them', () => {
    // No real event has two, but the dedup must key on id rather than assume one.
    const two = {
      ...EVENT,
      companies: [apiCompany(), apiCompany({ companyID: 900, companyName: 'Second Org' }), apiCompany()],
    }
    expect(mapEvent(two).companies.map(c => c.id)).toEqual([714, 900])
  })

  it('drops a company row with no usable name', () => {
    const nameless = { ...EVENT, companies: [apiCompany({ companyName: '   ' })] }
    expect(mapEvent(nameless).companies).toEqual([])
  })

  it('uses empty strings, never null, for location and url', () => {
    const bare = { ...EVENT, location: null, url: '   ' }
    const event = mapEvent(bare)
    expect(event.location).toBe('')
    expect(event.url).toBe('')
  })

  it('reads compId 0 as no organiser', () => {
    // The wire uses 0 and null interchangeably here.
    expect(mapEvent({ ...EVENT, compId: 0 }).compId).toBeNull()
    expect(mapEvent({ ...EVENT, compId: null }).compId).toBeNull()
  })

  it('falls back to the start date when the end date is unusable', () => {
    const event = mapEvent({ ...EVENT, endDate: null })
    expect(event.endDate).toBe('2009-07-16T00:00:00+08:00')
  })

  it('still produces a complete record when both dates are junk', () => {
    const event = mapEvent({ ...EVENT, startDate: null, endDate: null })
    expect(event.startDate).toBe('')
    expect(event.endDate).toBe('')
    for (const [key, value] of Object.entries(event)) {
      expect(value, `${key} should not be undefined`).not.toBeUndefined()
    }
  })

  it('handles an event with no organiser at all — the common case', () => {
    // 718 of 839 events look like this.
    const orphan = { ...EVENT, compId: null, companies: [] }
    const event = mapEvent(orphan)
    expect(event.companies).toEqual([])
    expect(canHaveReleases(event)).toBe(false)
  })
})

describe('mapEventCompany', () => {
  it('resolves the logo and absolutises the url', () => {
    const company = mapEventCompany(apiCompany())!
    expect(company.id).toBe(714)
    expect(company.name).toBe('Asian Publishing Convention')
    expect(company.logo).toBe('https://www.acnnewswire.com/images/company/AP10.gif')
    expect(company.url).toBe('https://publishingconvention.com')
  })

  it('nulls a missing logo and url rather than inventing paths', () => {
    const company = mapEventCompany(apiCompany({ logoFileName: '', companyURL: '' }))!
    expect(company.logo).toBeNull()
    expect(company.url).toBeNull()
  })
})

describe('mapEventRelease', () => {
  it('maps systemDate to dateTime, offsetless', () => {
    // Unlike Event.startDate, this one carries a real clock time and the
    // contract specifies it is passed through unchanged.
    const release = mapEventRelease({
      articleId: 1978,
      headline: 'Winners Receive Asian Multimedia Publishing Awards 2009',
      summary: 'Eight winners and 16 excellence awardees.',
      systemDate: '2009-07-24T17:36:15',
      companyId: 2,
    })
    expect(release.id).toBe(1978)
    expect(release.dateTime).toBe('2009-07-24T17:36:15')
    expect(release.dateTime).not.toContain('+08:00')
    expect(release.companyId).toBe(2)
  })

  it('nulls an empty summary', () => {
    const release = mapEventRelease({
      articleId: 1, headline: 'H', summary: '   ', systemDate: '2009-01-01T00:00:00', companyId: null,
    })
    expect(release.summary).toBeNull()
    expect(release.companyId).toBeNull()
  })
})

describe('isPublished', () => {
  it('reads "y" as published and a blank as not', () => {
    // 816 of 839 are "y"; the other 23 are a single space, not "n".
    expect(isPublished(EVENT)).toBe(true)
    expect(isPublished({ ...EVENT, publish: ' ' })).toBe(false)
    expect(isPublished({ ...EVENT, publish: null })).toBe(false)
  })
})

describe('eventYear', () => {
  it('takes the year the wire wrote, not a local-time reading of it', () => {
    // 1 Jan +08:00 is still 2009, even where local time would say 2008.
    const event = mapEvent({ ...EVENT, startDate: '2009-01-01T00:00:00' })
    expect(eventYear(event)).toBe(2009)
  })

  it('is null when there is no start date to read', () => {
    expect(eventYear(mapEvent({ ...EVENT, startDate: null, endDate: null }))).toBeNull()
  })
})

describe('canHaveReleases', () => {
  it('needs both an organiser and a year', () => {
    expect(canHaveReleases(mapEvent(EVENT))).toBe(true)
    expect(canHaveReleases(mapEvent({ ...EVENT, compId: null }))).toBe(false)
    expect(canHaveReleases(mapEvent({ ...EVENT, startDate: null, endDate: null }))).toBe(false)
  })
})

// ── /api/Events/full ────────────────────────────────────────────────────────
//
// Real response for event 163, verbatim from the live probe of 2026-09-23 —
// the same event as the legacy fixture above, which is what makes the parity
// test below meaningful.

const EVENT_FULL: ApiEventFull = {
  id: 163,
  name: '3rd Asian Publishing Convention',
  startDate: '2009-07-16T00:00:00+08:00',
  endDate: '2009-07-17T23:59:59+08:00',
  location: 'Manila',
  url: 'https://www.publishingconvention.com',
  photo: 'https://www.acnnewswire.com/eventimages/ap10.jpg',
  isPublished: true,
  organiserId: 714,
  organisers: [
    {
      id: 714,
      name: 'Asian Publishing Convention',
      logo: 'https://www.acnnewswire.com/images/company/AP10.gif',
      url: 'https://publishingconvention.com',
    },
  ],
}

describe('mapEventFull', () => {
  it('maps the reconciled shape onto the unchanged app model', () => {
    const event = mapEventFull(EVENT_FULL)

    expect(event.id).toBe(163)
    // `name` on the wire, still `description` on the contract.
    expect(event.description).toBe('3rd Asian Publishing Convention')
    // `organiserId`/`organisers` on the wire, still `compId`/`companies`.
    expect(event.compId).toBe(714)
    expect(event.companies).toEqual([
      {
        id: 714,
        name: 'Asian Publishing Convention',
        logo: 'https://www.acnnewswire.com/images/company/AP10.gif',
        url: 'https://publishingconvention.com',
      },
    ])
  })

  it('passes the wire offsets through instead of re-stamping them', () => {
    const event = mapEventFull(EVENT_FULL)
    expect(event.startDate).toBe('2009-07-16T00:00:00+08:00')
    // Already 23:59:59 upstream - not pushed there a second time.
    expect(event.endDate).toBe('2009-07-17T23:59:59+08:00')
  })

  it('produces the same record as the legacy mapper for the same event', () => {
    // The whole point of the admin's two-source events loader: rows that come
    // from /full and rows that come from the legacy sweep have to be
    // indistinguishable once mapped, or the list renders two shapes.
    expect(mapEventFull(EVENT_FULL)).toEqual(mapEvent(EVENT))
  })

  it('still repairs a relative url, should the wire regress', () => {
    const event = mapEventFull({ ...EVENT_FULL, url: 'www.example.com' })
    expect(event.url).toBe('https://www.example.com')
  })

  it('still stamps an offset onto an offsetless date, should the wire regress', () => {
    const event = mapEventFull({
      ...EVENT_FULL,
      startDate: '2009-07-16T00:00:00',
      endDate: '2009-07-17T00:00:00',
    })
    expect(event.startDate).toBe('2009-07-16T00:00:00+08:00')
    expect(event.endDate).toBe('2009-07-17T23:59:59+08:00')
  })

  it('treats organiserId 0 as no organiser', () => {
    expect(mapEventFull({ ...EVENT_FULL, organiserId: 0 }).compId).toBeNull()
  })

  it('handles the 708 events with no organiser at all', () => {
    const event = mapEventFull({ ...EVENT_FULL, organiserId: null, organisers: [] })
    expect(event.compId).toBeNull()
    expect(event.companies).toEqual([])
    expect(canHaveReleases(event)).toBe(false)
  })

  it('drops an organiser with no usable name', () => {
    const event = mapEventFull({
      ...EVENT_FULL,
      organisers: [{ id: 714, name: '  ', logo: null, url: null }],
    })
    expect(event.companies).toEqual([])
  })

  it('tolerates a null organisers array', () => {
    expect(mapEventFull({ ...EVENT_FULL, organisers: null }).companies).toEqual([])
  })
})
