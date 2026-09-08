// src/lib/api/map-event.ts
// Wire event → Event / EventRelease.
//
// This implements the public site's events contract (schemas/events.json), so
// the three transforms below are contract requirements rather than local taste.
// Changing any of them changes what the site renders.
//
//   1. Dates gain an explicit +08:00 offset. See WIRE_OFFSET.
//   2. `endDate` is pushed to 23:59:59 of its day. See toEventIso.
//   3. `companies` is deduped by id. See mapEvent.
//
// What the API has no value for, and is therefore left blank:
//
//   pressReleaseUrl — always null. In the contract, so it is kept; the release
//                     feed comes from `mapEventRelease` instead.
//
// Fields the API sends that the contract has no home for, and why:
//
//   lid       — "2" on all 839 events. No variation, so nothing to model.
//   publish   — "y" on 816, blank on 23. Read by `isPublished` rather than put
//               on the record, since the contract has no field for it.
//   inUrl     — a relative link into the legacy ASP site
//               ("/events.asp?compid=714&yr=2009"). Superseded by compId +
//               year, which is what the release feed actually uses.

import { companyLogoUrl, eventImageUrl } from './media'
import type { ApiArticleCompany, ApiEvent } from './types'
import type { Event, EventCompany, EventRelease } from '../../types/event.types'

/**
 * The wire's timezone, as a fixed +08:00 offset.
 *
 * The API sends event dates as an offsetless date-only midnight
 * ("2009-07-16T00:00:00"), which every JS date parser reads as *local* time. Left
 * alone, an event on the 16th renders as the 15th for any visitor west of the
 * wire — an off-by-one-day bug that only appears in some timezones, which is the
 * kind that survives review.
 *
 * A fixed offset rather than a named zone because these are date-only values
 * with no clock time to shift: the point is to pin which calendar day is meant,
 * not to model Hong Kong's civil time. It also means no DST question, and the
 * wire's own zone has no DST anyway.
 */
export const WIRE_OFFSET = '+08:00'

function str(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * A wire date → ISO 8601 with the wire's offset.
 *
 * `endOfDay` pushes the time to 23:59:59, which is what `endDate` needs: the API
 * gives the last day at midnight, and an event whose end is "the 17th at
 * 00:00:00" reads as already finished for the whole of the 17th.
 *
 * Only the date part of the input is used. Anything unparseable returns null so
 * a bad row surfaces as a missing date rather than as "Invalid Date".
 */
export function toEventIso(value: string | null | undefined, endOfDay = false): string | null {
  const raw = str(value)
  if (!raw) return null

  // Take the calendar date the wire wrote, without letting a parser reinterpret
  // it in another zone first.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (!match) return null

  const [, year, month, day] = match
  // Reject a date the wire mangled — month 13, day 32 — rather than emitting it.
  const probe = new Date(`${year}-${month}-${day}T00:00:00Z`)
  if (Number.isNaN(probe.getTime())) return null

  const time = endOfDay ? '23:59:59' : '00:00:00'
  return `${year}-${month}-${day}T${time}${WIRE_OFFSET}`
}

/**
 * A bare hostname → an absolute https:// URL.
 *
 * The wire stores these the way they were typed in 2009: "www.example.com", with
 * no scheme. An href without a scheme is treated as a *relative* path, so
 * `<a href="www.example.com">` on /events/163 navigates to
 * /events/www.example.com. Normalising here is what stops that.
 *
 * A value that is ALREADY absolute is returned untouched, including an http one.
 * The contract's wording says "normalised to an absolute https:// URL", and this
 * deliberately stops one step short of that: exactly one of the 839 events
 * (#507, WBE 2022) is stored as `http://www.battery-expo.com`, and that host
 * does not answer on https at all — the http URL returns 200 while the https
 * one fails to connect. Rewriting the scheme to satisfy the contract would break
 * the only link it applies to. What the contract is really asking for is
 * absolute rather than relative, which this does give it.
 *
 * A leading slash is stripped before prefixing, because two events store their
 * URL that way (#518 "/www.terrapinn.com/...", #1016 "/indonesia.dccisummit.com").
 */
export function toAbsoluteUrl(value: string | null | undefined): string | null {
  const raw = str(value)
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  // A stored value that is only punctuation or a stray slash is not a host.
  const host = raw.replace(/^\/+/, '')
  if (!/[a-z0-9]/i.test(host)) return null
  return `https://${host}`
}

/** An organiser company. Returns null for a row with no usable name. */
export function mapEventCompany(api: ApiArticleCompany): EventCompany | null {
  const name = str(api.companyName)
  if (!name) return null

  return {
    id: api.companyID,
    name,
    logo: companyLogoUrl(api.logoFileName),
    url: toAbsoluteUrl(api.companyURL),
  }
}

/**
 * Whether the event is published on the wire.
 *
 * `publish` is "y" on 816 of 839 events and a blank string on the other 23. The
 * contract has no field for it, so it is exposed as a predicate the admin list
 * can filter on without putting a non-contract field on the record.
 */
export function isPublished(api: ApiEvent): boolean {
  return str(api.publish)?.toLowerCase() === 'y'
}

/**
 * `GET /api/Events` row → Event.
 *
 * The dedup is the part that matters. The API returns `companies` as one entry
 * per release the organiser has — 168 identical copies on the worst event — so
 * a naive map produces a record that is mostly repetition and a UI that renders
 * the same logo 168 times. Measured across all 839 events, no event has two
 * *distinct* companies, so collapsing by id loses nothing.
 */
export function mapEvent(api: ApiEvent): Event {
  const seen = new Set<number>()
  const companies: EventCompany[] = []

  for (const row of api.companies ?? []) {
    if (seen.has(row.companyID)) continue
    seen.add(row.companyID)
    const company = mapEventCompany(row)
    if (company) companies.push(company)
  }

  const start = toEventIso(api.startDate)
  // A row with no usable start date still has to produce a valid Event, so the
  // empty string stands in — the same convention the mappers use for a date the
  // wire didn't give (see map-company.ts).
  return {
    id: api.id,
    startDate: start ?? '',
    endDate: toEventIso(api.endDate, true) ?? start ?? '',
    description: str(api.description) ?? '',
    // The contract says empty string, never null, for these two.
    location: str(api.location) ?? '',
    url: toAbsoluteUrl(api.url) ?? '',
    pressReleaseUrl: null,
    photo: eventImageUrl(api.eventImage),
    // 0 is not a company id; the wire uses it interchangeably with null.
    compId: api.compId ? api.compId : null,
    companies,
  }
}

/** `GET /api/Events/company/{compId}/year/{year}` row → EventRelease. */
export function mapEventRelease(api: {
  articleId: number
  headline: string | null
  summary: string | null
  systemDate: string | null
  companyId: number | null
}): EventRelease {
  return {
    id: api.articleId,
    headline: str(api.headline) ?? '',
    summary: str(api.summary),
    // Passed through unchanged: the contract specifies no offset here, unlike
    // Event.startDate, because this one carries a real clock time.
    dateTime: str(api.systemDate) ?? '',
    companyId: api.companyId ?? null,
  }
}

/**
 * The year to ask for an event's releases.
 *
 * Taken from the start date's calendar year as the *wire* wrote it, not via a
 * Date — an event starting 2009-01-01+08:00 is still filed under 2009 even
 * where a local-time reading would put it in 2008.
 */
export function eventYear(event: Event): number | null {
  const match = /^(\d{4})/.exec(event.startDate)
  return match ? parseInt(match[1], 10) : null
}

/** Whether this event can have a release feed at all. */
export function canHaveReleases(event: Event): boolean {
  return event.compId !== null && eventYear(event) !== null
}
