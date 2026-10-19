// src/pages/events/EventDetailPage.tsx
// One event: its details, and the releases filed against it. Also the create
// form, at /events/new.
//
// The event comes out of the cached list rather than from an endpoint, because
// `GET /api/Events/{id}` answers 500 for every id. That is invisible here by
// design — `useEventRecord` handles it — but it is why opening an event by URL
// on a cold start waits for the whole set.
//
// Saving is local-first (see lib/events/write.ts): a draft the API did not
// accept stays in localStorage and is reopened here until a save goes through.

import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Topbar } from '../../components/ui/Topbar'
import { Field } from '../../components/ui/Field'
import { SectionNav } from '../../components/ui/SectionNav'
import { useEventRecord, useEventReleases, useRefreshRecords } from '../../hooks/useRecords'
import { useToastStore } from '../../store/toast.store'
import { formatEventDates, formatReleaseDate, eventStatus } from '../../lib/events/format'
import { clearPendingEvent, loadPendingEvent } from '../../lib/events/storage'
import {
  blankEventDraft,
  changedFields,
  deleteEventRecord,
  draftFromEvent,
  submitEventDraft,
  validateEventDraft,
  type EventDraft,
} from '../../lib/events/write'

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const refresh = useRefreshRecords()
  const addToast = useToastStore(s => s.addToast)
  const isNew = id === 'new'
  const numericId = id && /^\d+$/.test(id) ? parseInt(id, 10) : null

  const { event, data, isLoading, notFound } = useEventRecord(numericId)
  const { data: releases, isLoading: releasesLoading } = useEventReleases(event)
  const published = numericId === null || !data?.unpublishedIds.has(numericId)

  // What the wire holds. The form edits a draft on top of it; `key` on the form
  // remounts it if the event changes underneath.
  const initial = useMemo<EventDraft>(
    () => (event ? draftFromEvent(event, published) : blankEventDraft()),
    [event, published]
  )
  // A draft left over from a save the API did not accept, if there is one.
  const [draft, setDraft] = useState<EventDraft | null>(() => loadPendingEvent(isNew ? null : numericId))
  const [restored] = useState(draft !== null)
  const current = draft ?? initial
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft({ ...current, [key]: value })

  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const errors = validateEventDraft(current)
  const changed = changedFields(initial, current)

  const save = async () => {
    setBusy('saving')
    setNotice(null)
    const result = await submitEventDraft(current)
    if (result.ok) {
      // Re-read before dropping the draft, so the form doesn't flash the old values.
      await refresh('events')
      setDraft(null)
      addToast('Saved to the newswire.', 'success')
      if (isNew) navigate(result.id !== null ? `/events/${result.id}` : '/events', { replace: true })
    } else if (result.reason === 'local') {
      addToast(result.message, 'warning', 8000)
    } else {
      setNotice(result.message)
    }
    setBusy(null)
  }

  const remove = async () => {
    if (numericId === null) return
    if (!window.confirm(`Delete "${current.description || `#${numericId}`}"? This removes it from the newswire and cannot be undone.`)) return
    setBusy('deleting')
    try {
      await deleteEventRecord(numericId)
      await refresh('events')
      addToast('Event deleted.', 'success')
      navigate('/events')
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), 'error', 6000)
      setBusy(null)
    }
  }

  const discard = () => {
    clearPendingEvent(isNew ? null : numericId)
    setDraft(null)
    setNotice(null)
  }

  if (isLoading && !isNew) {
    return (
      <div className="companies-page">
        <div className="companies-empty"><span>Loading event…</span></div>
      </div>
    )
  }

  if (!isNew && (numericId === null || notFound || !event)) {
    return (
      <div className="companies-page">
        <Topbar
          breadcrumb={<SectionNav current="events" trail="Not found" />}
        />
        <div className="companies-empty">
          <span>No event with id {id}.</span>
          <Button variant="outline" size="sm" onClick={() => navigate('/events')}>Back to events</Button>
        </div>
      </div>
    )
  }

  const status = event ? eventStatus(event) : null
  const organiser = event?.companies[0]

  return (
    <div className="companies-page">
      <Topbar
        breadcrumb={
          <SectionNav
            current="events"
            trail={isNew ? 'New event' : event?.description || `#${event?.id}`}
          />
        }
        actions={
          <>
            {changed.length > 0 && (
              <span className="hint">
                {changed.length} unsaved change{changed.length === 1 ? '' : 's'}
              </span>
            )}
            {!isNew && (
              <Button variant="danger" size="sm" onClick={remove} disabled={busy !== null}>
                {busy === 'deleting' ? 'Deleting…' : 'Delete'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={changed.length === 0 || busy !== null}
              onClick={discard}
            >
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              disabled={changed.length === 0 || busy !== null}
            >
              {busy === 'saving' ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />

      {restored && changed.length > 0 && (
        <div className="companies-notice companies-notice--bench">
          <strong>Unsent changes restored.</strong> An earlier save could not reach the API and
          was kept locally. Save to send it again, or Discard to drop it.
        </div>
      )}

      <div className="event-detail">
        <section className="event-detail__main">
          {event && (
            <div className="event-detail__head">
              {event.photo && (
                // A raw <img>: /eventimages/ is on the public site, and 16 of 839
                // events have no image at all.
                <img className="event-detail__photo" src={event.photo} alt="" />
              )}
              <div>
                <h1 className="event-detail__title">{event.description || 'Untitled event'}</h1>
                <div className="event-detail__meta">
                  <span className={`badge badge--${status}`}>{status}</span>
                  <span>{formatEventDates(event)}</span>
                  {event.location && <span>· {event.location}</span>}
                </div>
                {event.url && (
                  <a className="event-detail__link" href={event.url} target="_blank" rel="noreferrer noopener">
                    {event.url}
                  </a>
                )}
              </div>
            </div>
          )}
          {isNew && <h1 className="event-detail__title">New event</h1>}

          <div className="event-detail__form">
            <Field
              label="Event name"
              value={current.description}
              onChange={e => set('description', e.target.value)}
              error={errors.find(x => x.field === 'description')?.message}
              hint="The page heading. The API has no separate title field."
            />
            <div className="event-detail__row">
              <Field
                label="Start date"
                type="date"
                value={current.startDate}
                onChange={e => set('startDate', e.target.value)}
                error={errors.find(x => x.field === 'startDate')?.message}
              />
              <Field
                label="End date"
                type="date"
                value={current.endDate}
                onChange={e => set('endDate', e.target.value)}
                error={errors.find(x => x.field === 'endDate')?.message}
                hint="Rendered as 23:59:59 +08:00, so the final day still counts."
              />
            </div>
            <Field
              label="Location"
              value={current.location}
              onChange={e => set('location', e.target.value)}
              placeholder="e.g. Singapore, Shanghai, Hong Kong"
              hint="Free text — the wire stores no structured location."
            />
            <Field
              label="Organiser website"
              value={current.url}
              onChange={e => set('url', e.target.value)}
              placeholder="e.g. www.publishingconvention.com"
              hint="Stored without a scheme; https:// is added on read."
            />
            <div className="event-detail__row">
              <Field
                label="Event image"
                value={current.eventImage}
                onChange={e => set('eventImage', e.target.value)}
                placeholder="e.g. ap10.jpg"
                error={errors.find(x => x.field === 'eventImage')?.message}
                hint="Filename only, under /eventimages/."
              />
              <Field
                label="Organiser company id"
                value={current.compId === null ? '' : String(current.compId)}
                onChange={e => {
                  const raw = e.target.value.trim()
                  set('compId', raw === '' ? null : Number(raw))
                }}
                placeholder="e.g. 714"
                error={errors.find(x => x.field === 'compId')?.message}
                hint="The only key linking an event to its releases. Blank on most events."
              />
            </div>
            <label className="event-detail__publish">
              <input
                type="checkbox"
                checked={current.publish}
                onChange={e => set('publish', e.target.checked)}
              />
              {' '}Published on the site
            </label>
          </div>

          {notice && (
            <div className="companies-notice companies-notice--bench">{notice}</div>
          )}
        </section>

        {event && (
          <aside className="event-detail__side">
            <h2 className="event-detail__h2">Organiser</h2>
            {organiser ? (
              <div className="event-detail__org">
                {organiser.logo && <img src={organiser.logo} alt="" />}
                <div>
                  <div style={{ fontWeight: 500 }}>{organiser.name}</div>
                  <div className="hint monospace">#{organiser.id}</div>
                  {organiser.url && (
                    <a href={organiser.url} target="_blank" rel="noreferrer noopener">{organiser.url}</a>
                  )}
                </div>
              </div>
            ) : (
              <p className="hint">
                No organiser on this event. 718 of 839 have none, and without one there is
                no way to resolve a release feed.
              </p>
            )}

            <h2 className="event-detail__h2">
              Releases
              {releases && releases.length > 0 && <span className="hint"> · {releases.length}</span>}
            </h2>

            {event.compId === null ? (
              <p className="hint">No organiser id, so no release feed is possible.</p>
            ) : releasesLoading ? (
              <p className="hint">Loading releases…</p>
            ) : !releases || releases.length === 0 ? (
              <p className="hint">No releases filed against this organiser for {event.startDate.slice(0, 4)}.</p>
            ) : (
              <ul className="event-releases">
                {releases.map(release => (
                  <li key={release.id}>
                    <button
                      type="button"
                      className="event-releases__item"
                      onClick={() => navigate(`/article/${release.id}`)}
                    >
                      <span className="event-releases__headline">{release.headline}</span>
                      <span className="hint">{formatReleaseDate(release.dateTime)}</span>
                      {release.summary && (
                        <span className="event-releases__summary">{release.summary}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
