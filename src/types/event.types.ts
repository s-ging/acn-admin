// src/types/event.types.ts
// The event model.
//
// These types implement the events data contract published by the public site
// (schemas/events.json) rather than inventing a shape of their own, so the admin
// and the site agree on what an event is. Where that contract and this app's own
// conventions differ, the contract wins — it is what the rendered pages consume.
//
// Two consequences of the contract worth reading before using these:
//
//   `description` is the event's NAME. The API has no separate title field, so
//   this is what a page renders as its heading. It is not prose about the event.
//
//   `startDate` / `endDate` carry an explicit +08:00 offset, stamped on during
//   mapping. The API sends an offsetless date-only midnight, which a browser
//   reads in the *visitor's* timezone — so an event on the 16th shows as the
//   15th to anyone west of the wire. See lib/api/map-event.ts.

/**
 * An organiser company attached to an event.
 *
 * `logo` and `url` are absolute URLs by the time they get here; the API sends a
 * bare filename and a bare hostname respectively.
 */
export interface EventCompany {
  id: number
  /** Sanitised. Entries that map to an empty name are dropped during mapping. */
  name: string
  /** Absolute, under https://www.acnnewswire.com/images/company/. */
  logo: string | null
  /** Absolute https:// URL. */
  url: string | null
}

/**
 * One event.
 *
 * Mapped from `GET /api/Events`, which is also the source for a single event:
 * `GET /api/Events/{id}` answers 500 for every id tried, so there is no detail
 * endpoint to call and the list is the only way in. See lib/api/repository.ts.
 */
export interface Event {
  id: number
  /** ISO 8601 with an explicit +08:00 offset. */
  startDate: string
  /** As `startDate`, but at 23:59:59 so an event on its final day still reads as running. */
  endDate: string
  /** The event NAME — see the note at the top of this file. */
  description: string
  /** Free-text and unstructured. Empty string when absent, never null. */
  location: string
  /** Organiser website, normalised to absolute https://. Empty string when absent. */
  url: string
  /**
   * Always null.
   *
   * Kept because it is in the published contract: the site's own shape still
   * declares it, and dropping it here would make the two disagree. The release
   * feed comes from `EventRelease` instead.
   */
  pressReleaseUrl: string | null
  /** Absolute, under https://www.acnnewswire.com/eventimages/. */
  photo: string | null
  /**
   * Organiser company id, and the only key relating an event to its releases.
   *
   * Null on most events — 718 of 839 on the dev host — and those can never
   * resolve a release feed. Anything reading this has to handle the null case as
   * the common one rather than the exception.
   */
  compId: number | null
  /**
   * Organiser companies, deduped by id.
   *
   * The API repeats the same company once per release it has, up to 168 times on
   * a single event; mapping collapses that. Measured across all 839 events, the
   * deduped length is only ever 0 or 1 and never carries two distinct companies,
   * so `companies[0]` is the organiser.
   */
  companies: EventCompany[]
}

/**
 * A press release filed against an event.
 *
 * From `GET /api/Events/company/{compId}/year/{year}` — so reaching these needs
 * an event's `compId` and the year of its `startDate`, and an event without a
 * `compId` has no feed at all.
 */
export interface EventRelease {
  /** The articleId. Links to /article/{id}. */
  id: number
  headline: string
  /** Null when the API returns an empty summary. */
  summary: string | null
  /**
   * Mapped from the API's `systemDate`.
   *
   * No offset, unlike `Event.startDate` — passed through as the API returns it,
   * because the contract specifies it that way.
   */
  dateTime: string
  companyId: number | null
}

/** What an event page renders: the event, and the releases filed against it. */
export interface EventPageData {
  event: Event
  releases: EventRelease[]
}
