// src/lib/events/write.ts
// The event write path: POST /api/Events, PUT /api/Events/{id},
// DELETE /api/Events/{id}.
//
// A save is local-first, as companies are (lib/companies/sync.ts): the draft is
// written to localStorage, then sent. If the send fails the draft stays there as
// a pending edit, the detail page reopens it, and the next Save retries. Only a
// successful send clears it.

import { ApiError } from '../api/client'
import { createEvent, createdId, deleteEvent, updateEvent } from '../api/endpoints'
import type { SaveEventDto } from '../api/types'
import { clearPendingEvent, savePendingEvent } from './storage'
import type { Event } from '../../types/event.types'

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
  | { ok: true; id: number | null }
  | { ok: false; reason: 'invalid'; message: string; errors: FieldError[] }
  | { ok: false; reason: 'local'; message: string }

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return 'the API refused the request — check VITE_API_TOKEN'
    if (err.status === 0) return 'the API could not be reached'
  }
  return err instanceof Error ? err.message : String(err)
}

/**
 * Saves a draft: validate, keep a local copy, send, and clear the local copy
 * once the API has it.
 *
 * Returns the event's id on success — the new one for a create, or null if the
 * API created it without saying which id it got.
 */
export async function submitEventDraft(draft: EventDraft): Promise<WriteResult> {
  const errors = validateEventDraft(draft)
  if (errors.length > 0) {
    return {
      ok: false,
      reason: 'invalid',
      message: `${errors.length} field${errors.length === 1 ? '' : 's'} need attention.`,
      errors,
    }
  }

  savePendingEvent(draft)
  const payload = eventDraftPayload(draft)

  try {
    if (draft.id === null) {
      const id = createdId(await createEvent(payload))
      clearPendingEvent(null)
      return { ok: true, id }
    }
    await updateEvent(draft.id, payload)
    clearPendingEvent(draft.id)
    return { ok: true, id: draft.id }
  } catch (err) {
    return {
      ok: false,
      reason: 'local',
      message: `Saved locally only: ${describe(err)}. It will be sent on the next save.`,
    }
  }
}

/** Deletes an event. Throws if the API refuses — there is no local fallback for a delete. */
export async function deleteEventRecord(id: number): Promise<void> {
  try {
    await deleteEvent(id)
  } catch (err) {
    throw new Error(`Could not delete: ${describe(err)}.`, { cause: err })
  }
  clearPendingEvent(id)
}

/**
 * The draft as the API wants it — the /full field names (`name`, `isPublished`,
 * `organiserId`), not the legacy ones this app reads from.
 *
 * Dates go as date-only `YYYY-MM-DD`: the +08:00 offset and the 23:59:59 end
 * are read-side repairs, and sending them back would change what is stored.
 */
export function eventDraftPayload(draft: EventDraft): SaveEventDto {
  return {
    name: draft.description.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate || null,
    location: draft.location.trim(),
    // Stored bare on the wire; normalised to https:// on read.
    url: draft.url.trim().replace(/^https?:\/\//i, ''),
    eventImage: draft.eventImage.trim(),
    isPublished: draft.publish,
    organiserId: draft.compId,
  }
}
