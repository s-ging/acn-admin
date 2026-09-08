// src/lib/events/write.ts
// The event write path, benched.
//
// Benched, not absent: the editor form, its validation and its change
// detection are all real and exercised, and the only thing that does not happen
// is the request. That is deliberate — the interesting part of a write path is
// the shape of what you would send and whether the form can produce it, and
// both can be settled now. Turning it on should be a one-line change here plus
// an `apiSend` call in `submitEventDraft`.
//
// It is benched for two reasons, and the second is the one that matters:
//
//   1. It was asked to be.
//   2. There is nothing to call. Every operation in the swagger document is a
//      GET — there is no POST/PUT/PATCH/DELETE for events, or for anything else.
//      A write path here could only 404 or 405.
//
// So `EVENTS_WRITE` is not hiding a finished feature behind a flag. It is
// marking a boundary the API has not yet reached, and `PROPOSED_ENDPOINTS`
// records what would have to exist on the other side of it.

import type { Event } from '../../types/event.types'

/**
 * Whether event writes are live.
 *
 * Flip to true ONLY once the endpoints in `PROPOSED_ENDPOINTS` exist and
 * `submitEventDraft` actually calls them — on its own this flag just changes a
 * refusal into a broken request.
 */
export const EVENTS_WRITE = false

/**
 * The endpoints a live write path would need.
 *
 * Written down rather than left implicit so the request to the API team is a
 * concrete one. Field names follow the wire's existing casing for events
 * (`compId`, `eventImage`, `publish`), not this app's, because that is what the
 * rest of the API uses.
 */
export const PROPOSED_ENDPOINTS = {
  create: 'POST /api/Events',
  update: 'PUT /api/Events/{id}',
  delete: 'DELETE /api/Events/{id}',
  /**
   * `GET /api/Events/{id}` is in the spec but answers 500 for every id. A write
   * path needs it working: without a read-back there is no way to confirm what
   * was saved, and the list is cached for an hour.
   */
  readBack: 'GET /api/Events/{id} — currently 500, needs fixing',
} as const

/**
 * The editable shape of an event.
 *
 * Narrower than `Event` on purpose. `id` is not editable, `companies` is derived
 * from `compId` by the server rather than set directly, and `pressReleaseUrl` is
 * always null. `photo` is a filename here, not the absolute URL the read model
 * carries — the wire stores `eventImage` as a bare filename, so that is what a
 * write would send.
 */
export interface EventDraft {
  /** Absent when creating. */
  id: number | null
  /** The event NAME. See the note in types/event.types.ts. */
  description: string
  /** `YYYY-MM-DD`, as an <input type="date"> gives it. */
  startDate: string
  endDate: string
  location: string
  /** Organiser website. Stored bare on the wire; normalised on read. */
  url: string
  /** A bare filename under /eventimages/, e.g. "ap10.jpg". */
  eventImage: string
  /** Organiser company id. Null is legitimate — most events have none. */
  compId: number | null
  publish: boolean
}

/** `YYYY-MM-DD` out of the read model's offset-bearing ISO string. */
function toDateInput(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}/.exec(iso)?.[0] ?? ''
}

/** The filename back out of an absolute /eventimages/ URL. */
function toFilename(url: string | null): string {
  if (!url) return ''
  return url.split('/').pop() ?? ''
}

/** The draft for an existing event. */
export function draftFromEvent(event: Event, published: boolean): EventDraft {
  return {
    id: event.id,
    description: event.description,
    startDate: toDateInput(event.startDate),
    endDate: toDateInput(event.endDate),
    location: event.location,
    url: event.url,
    eventImage: toFilename(event.photo),
    compId: event.compId,
    publish: published,
  }
}

/** A blank draft, for creating. */
export function blankEventDraft(): EventDraft {
  return {
    id: null,
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    url: '',
    eventImage: '',
    compId: null,
    publish: false,
  }
}

export interface FieldError {
  field: keyof EventDraft
  message: string
}

/**
 * What is wrong with this draft.
 *
 * Modelled on what the wire actually holds rather than on what feels tidy: 718
 * of 839 events have no `compId`, most have no location worth speaking of, and
 * 16 have no image — so none of those are required. Only the name and a
 * coherent date range are.
 */
export function validateEventDraft(draft: EventDraft): FieldError[] {
  const errors: FieldError[] = []

  if (!draft.description.trim()) {
    errors.push({ field: 'description', message: 'An event needs a name — it is the page heading.' })
  }
  if (!draft.startDate) {
    errors.push({ field: 'startDate', message: 'A start date is required.' })
  }
  if (!draft.endDate) {
    errors.push({ field: 'endDate', message: 'An end date is required.' })
  }
  if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
    errors.push({ field: 'endDate', message: 'The end date cannot be before the start date.' })
  }
  if (draft.eventImage.includes('/')) {
    errors.push({
      field: 'eventImage',
      message: 'Just the filename, e.g. "ap10.jpg" — the /eventimages/ path is added on read.',
    })
  }
  if (draft.compId !== null && (!Number.isInteger(draft.compId) || draft.compId <= 0)) {
    errors.push({ field: 'compId', message: 'An organiser id is a positive whole number, or blank.' })
  }

  return errors
}

/** The fields that differ from the draft this one started as. */
export function changedFields(before: EventDraft, after: EventDraft): (keyof EventDraft)[] {
  return (Object.keys(after) as (keyof EventDraft)[]).filter(key => before[key] !== after[key])
}

export type WriteResult =
  | { ok: true }
  | { ok: false; reason: 'benched' | 'invalid'; message: string; errors?: FieldError[] }

/**
 * Where a save would happen.
 *
 * Validation runs for real, so an invalid draft is reported as invalid rather
 * than as benched — that is the more useful answer, and it keeps the validation
 * honest while the request is parked.
 *
 * The payload is built and returned to the caller even though it is not sent, so
 * the editor can show exactly what it would post. That is the whole point of a
 * bench: the thing is assembled and inspectable, just not connected.
 */
export async function submitEventDraft(
  draft: EventDraft
): Promise<WriteResult & { payload?: Record<string, unknown> }> {
  const errors = validateEventDraft(draft)
  if (errors.length > 0) {
    return {
      ok: false,
      reason: 'invalid',
      message: `${errors.length} field${errors.length === 1 ? '' : 's'} need attention.`,
      errors,
    }
  }

  const payload = eventDraftPayload(draft)

  if (!EVENTS_WRITE) {
    return {
      ok: false,
      reason: 'benched',
      message: `Saving is off: the API has no write endpoint for events (${
        draft.id === null ? PROPOSED_ENDPOINTS.create : PROPOSED_ENDPOINTS.update
      } does not exist).`,
      payload,
    }
  }

  // When this turns on: apiSend(PROPOSED_ENDPOINTS…, payload), then invalidate
  // the cached event list — it is what the detail page reads from.
  throw new Error('EVENTS_WRITE is on but submitEventDraft has no request to make.')
}

/**
 * The draft as the wire would want it.
 *
 * The wire's field names and conventions, not this app's: `compId`, `eventImage`
 * as a bare filename, and `publish` as "y" or " " — which is how the existing
 * 839 records are stored, blank rather than "n".
 */
export function eventDraftPayload(draft: EventDraft): Record<string, unknown> {
  return {
    ...(draft.id === null ? {} : { id: draft.id }),
    description: draft.description.trim(),
    // Date-only midnight, matching how the wire stores these. The +08:00 offset
    // is a read-side concern; sending it back would change what is stored.
    startDate: `${draft.startDate}T00:00:00`,
    endDate: `${draft.endDate}T00:00:00`,
    location: draft.location.trim(),
    url: draft.url.trim().replace(/^https?:\/\//i, ''),
    eventImage: draft.eventImage.trim(),
    compId: draft.compId,
    publish: draft.publish ? 'y' : ' ',
    // Constant on all 839 existing records; sent so a created event matches them.
    lid: '2',
  }
}
