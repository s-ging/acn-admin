// src/lib/press-releases/dateline.ts
// The dateline lives inside the body text, not beside it.
//
// "TOKYO, August 14, 2020 - " is the opening of the first paragraph of the
// release, the way NewsML and the wires themselves treat it. Storing it as a
// separate field would mean the same words existed in two places, and every
// export would have to decide which one won.
//
// So the body is the single source of truth and these functions read and write
// its opening. The Dateline box on the canvas is a convenience over that, not a
// field of its own.
//
// ── The recognition rule, which is the part to confirm with the desk ─────────
//
// A first paragraph opens with a dateline when all of these hold:
//
//   1. There is a dash — hyphen, en or em — surrounded by spaces.
//   2. Everything before it is plain text: no markup, so a link or bold run
//      early in the paragraph can never be mistaken for one.
//   3. It is at most MAX_LENGTH characters.
//   4. Its first word is ALL CAPS, which is the wire convention for the city.
//
// Rule 4 is what stops "The company - which was founded in 1990 - said…" from
// having "The company" torn out of it. If the desk writes datelines some other
// way, this is the one place to change.

import type { PressRelease } from '../../types/press-release.types'

const MAX_LENGTH = 80

// A dash used as a separator has to have space around it, so hyphenated place
// names like WINSTON-SALEM survive.
const SEPARATOR = /\s+[-–—]\s+/

const ESCAPES: [RegExp, string][] = [
  [/&/g, '&amp;'],
  [/</g, '&lt;'],
  [/>/g, '&gt;'],
]

const escapeHTML = (text: string) =>
  ESCAPES.reduce((acc, [pattern, entity]) => acc.replace(pattern, entity), text)

const unescapeHTML = (html: string) =>
  html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')

const FIRST_PARAGRAPH = /^(\s*<p[^>]*>)([\s\S]*?)(<\/p>)/

function firstWordIsCity(text: string): boolean {
  const firstWord = text.trim().split(/[\s,]+/)[0] ?? ''
  // Two or more characters, and no lowercase letters in it.
  return firstWord.length >= 2 && firstWord === firstWord.toUpperCase() && /[A-Z]/.test(firstWord)
}

interface Located {
  /** The opening `<p …>` tag. */
  open: string
  /** Everything inside the paragraph. */
  inner: string
  /** The rest of the document from `</p>` onward. */
  tail: string
  /** The dateline text, if the paragraph opens with one. */
  dateline: string | null
  /** The paragraph's content with any dateline and separator removed. */
  body: string
}

function locate(html: string | null): Located | null {
  if (!html) return null
  const match = FIRST_PARAGRAPH.exec(html)
  if (!match) return null

  const [full, open, inner, close] = match
  const tail = close + html.slice(full.length)
  const separator = SEPARATOR.exec(inner)

  if (!separator) return { open, inner, tail, dateline: null, body: inner }

  const candidate = inner.slice(0, separator.index)
  const valid =
    !candidate.includes('<') &&
    candidate.length <= MAX_LENGTH &&
    candidate.trim().length > 0 &&
    firstWordIsCity(candidate)

  if (!valid) return { open, inner, tail, dateline: null, body: inner }

  return {
    open,
    inner,
    tail,
    dateline: unescapeHTML(candidate).trim(),
    body: inner.slice(separator.index + separator[0].length),
  }
}

/** The dateline the body currently opens with, or null if it doesn't. */
export function parseDateline(html: string | null): string | null {
  return locate(html)?.dateline ?? null
}

/**
 * Returns the body with its dateline set, replaced, or — given an empty string
 * — removed.
 *
 * Only ever rewrites the opening of the first paragraph. The rest of the
 * release is passed through untouched, so this cannot disturb someone's copy
 * further down.
 */
export function applyDateline(html: string | null, dateline: string): string | null {
  const next = dateline.trim()
  const located = locate(html)

  if (!located) {
    // No body yet — start one, but only if there's actually a dateline.
    return next ? `<p>${escapeHTML(next)} - </p>` : html
  }

  const { open, tail, body } = located
  if (!next) {
    // Clearing it leaves the paragraph, minus the dateline.
    return `${open}${body}${tail}`
  }

  return `${open}${escapeHTML(next)} - ${body}${tail}`
}

// ── Composing one from the release's own fields ──────────────────────────────

// Spelled out rather than via toLocaleDateString, so the wording can't shift
// with the machine's locale.
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * The dateline a release implies: its Location and its publication Date.
 *
 *   'Tokyo, Japan' + 2020-08-14  →  'TOKYO, August 14, 2020'
 *
 * The city is the first comma-segment of Location, uppercased — the wire
 * convention. Like the parse rule above, this is the line to change once the
 * desk says how they want it. Returns null when there is no Location, because a
 * dateline without a place is not a dateline.
 *
 * The date is read in local time, matching what <DateTimeField> displays.
 */
export function composeDateline(location: string | null, publishedAt: string | null): string | null {
  const city = location?.split(',')[0]?.trim().toUpperCase()
  if (!city) return null

  if (!publishedAt) return city
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return city

  return `${city}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

/**
 * The patch that brings a release's dateline back in line with its Location and
 * Date — the same shape as applyDerivedClassification, and empty for the same
 * reasons: nothing to do, or the editor has taken the field over.
 *
 * `dateline_overridden` is what stops this from ever rewriting copy someone
 * wrote by hand.
 */
export function applyAutoDateline(article: PressRelease): Partial<PressRelease> {
  if (article.dateline_overridden) return {}

  const composed = composeDateline(article.location, article.published_at)
  if (!composed) return {}

  const next = applyDateline(article.body_html, composed)
  return next === article.body_html ? {} : { body_html: next }
}
