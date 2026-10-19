// src/lib/events/storage.ts
// Event drafts that have not reached the API yet, under acn_event_draft_{id}
// (or _new for an event still being created). The fallback half of
// submitEventDraft: written before every send, removed once a send succeeds.

import type { EventDraft } from './write'

const PREFIX = 'acn_event_draft_'
const keyFor = (id: number | null) => `${PREFIX}${id ?? 'new'}`

export function savePendingEvent(draft: EventDraft): void {
  try {
    localStorage.setItem(keyFor(draft.id), JSON.stringify(draft))
  } catch {
    // Quota. The send still goes ahead; only the fallback is lost.
  }
}

export function loadPendingEvent(id: number | null): EventDraft | null {
  try {
    const raw = localStorage.getItem(keyFor(id))
    return raw ? (JSON.parse(raw) as EventDraft) : null
  } catch {
    return null
  }
}

export function clearPendingEvent(id: number | null): void {
  localStorage.removeItem(keyFor(id))
}
