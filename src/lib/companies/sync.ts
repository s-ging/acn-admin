// src/lib/companies/sync.ts
// Committing a company draft to the API, and deleting a company.
//
// The flow, for a company already on the wire:
//
//   1. fetch     fresh = GET /full                 what the API holds right now
//   2. conflicts diff(base, draft) vs diff(base, fresh)
//                — anything both sides changed, differently, stops the commit
//                  and goes back to the user to choose
//   3. rebase    working = fresh + the user's changes
//                — whatever someone else changed meanwhile is kept
//   4. send      diff(fresh, working), API-bound changes only
//   5. re-fetch  base = GET /full                  what the API actually stored
//   6. verify    leftover = diff(base, working)
//                — empty: the draft is deleted. Done.
//                — not empty: the draft is kept as base + leftover, so the
//                  editor shows exactly what did not land.
//
// "Did it land" is decided by step 6, never by which requests answered 200.
// Local-only changes (contacts, wire codes, … — no endpoint) always survive into
// the leftover and stay in the draft; they are never lost and never "failed".
//
// A company created here is POSTed first, re-keyed to the id the API assigns,
// and then goes through steps 4–6 against the newly created record.

import { ApiError } from '../api/client'
import { deleteCompany } from '../api/endpoints'
import { fetchCompanyBase, patchCachedCompany } from '../api/repository'
import { createFromChanges, sendChanges } from '../api/write'
import { applyChanges, diffCompany, findConflicts, type CompanyChange, type Conflict } from './diff'
import { blankCompany } from './blank'
import { deleteDraft, deleteLocalCompany, saveBase, saveDraft } from './storage'
import type { CompanyFull } from '../../types/company.types'

export type ConflictChoice = 'mine' | 'theirs'

export type CommitResult =
  /** Both sides changed the same thing. Nothing was sent. Commit again with a choice. */
  | { status: 'conflict'; conflicts: Conflict[] }
  /** Nothing reached the API. The draft is untouched. */
  | { status: 'failed'; message: string }
  | {
      status: 'done'
      id: number
      /** The API version after the commit — the editor's new base. */
      base: CompanyFull
      /** What is still uncommitted, or null when everything landed. */
      draft: CompanyFull | null
      /** API-bound changes the re-fetch does not show. */
      unlanded: CompanyChange[]
      /** Changes the API has no endpoint for; they stay in the draft. */
      localOnly: CompanyChange[]
      /** Requests that errored. Informational — `unlanded` is the verdict. */
      failures: string[]
      /** False when the re-fetch failed, so nothing could be verified. */
      verified: boolean
    }

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return 'the API refused the request — check VITE_API_TOKEN'
    if (err.status === 0) return 'the API could not be reached'
  }
  return err instanceof Error ? err.message : String(err)
}

/** What a company created here is diffed against: nothing at all. */
export function emptyBase(id: number): CompanyFull {
  return { ...blankCompany(id, ''), created_at: '', updated_at: '' }
}

const isNew = (draft: CompanyFull) => !!draft.created_at

/**
 * Commits `draft`. `base` is the API version the draft was made against — null
 * if the editor never had one (opened offline), in which case no conflict check
 * is possible and the fresh copy stands in for it.
 */
export async function commitCompany(
  base: CompanyFull | null,
  draft: CompanyFull,
  choice?: ConflictChoice
): Promise<CommitResult> {
  return isNew(draft) ? commitNew(draft) : commitExisting(base, draft, choice)
}

async function commitExisting(
  base: CompanyFull | null,
  draft: CompanyFull,
  choice?: ConflictChoice
): Promise<CommitResult> {
  let fresh: CompanyFull
  try {
    fresh = await fetchCompanyBase(draft.id)
  } catch (err) {
    return { status: 'failed', message: `Nothing was sent: ${describeError(err)}. Your changes are still saved locally.` }
  }

  let mine = diffCompany(base ?? fresh, draft)
  if (base) {
    const conflicts = findConflicts(mine, diffCompany(base, fresh))
    if (conflicts.length && !choice) return { status: 'conflict', conflicts }
    if (choice === 'theirs') {
      const theirs = new Set(conflicts.map(c => c.key))
      mine = mine.filter(c => !theirs.has(c.key))
    }
  }

  const working = applyChanges(fresh, mine)
  return sendAndVerify(draft.id, draft.id, fresh, working)
}

async function commitNew(draft: CompanyFull): Promise<CommitResult> {
  let id: number
  try {
    id = await createFromChanges(draft.name_en, diffCompany(emptyBase(draft.id), draft))
  } catch (err) {
    return { status: 'failed', message: `Not created: ${describeError(err)}. Your changes are still saved locally.` }
  }

  // Re-key at once: from here on the company exists on the wire, and a retry
  // must update it rather than create it again.
  const working: CompanyFull = { ...draft, id, created_at: '' }
  deleteDraft(draft.id)
  saveDraft(working)

  let fresh: CompanyFull
  try {
    fresh = await fetchCompanyBase(id)
  } catch {
    // Created but unreadable for now. Treat it as empty, so the sub-records are
    // still sent; re-sending the fields that the POST carried is harmless.
    fresh = emptyBase(id)
  }
  return sendAndVerify(id, draft.id, fresh, working)
}

async function sendAndVerify(
  id: number,
  previousId: number,
  fresh: CompanyFull,
  working: CompanyFull
): Promise<CommitResult> {
  const failures = await sendChanges(id, diffCompany(fresh, working))

  let base: CompanyFull
  let verified = true
  try {
    base = await fetchCompanyBase(id)
  } catch {
    // Sent, but can't confirm. Keep everything as a draft against the last
    // base we saw; the next commit re-checks it.
    base = fresh
    verified = false
  }
  saveBase(base)

  const leftover = diffCompany(base, working)
  const draft = leftover.length ? applyChanges(base, leftover) : null
  if (draft) saveDraft(draft)
  else deleteDraft(id)

  await patchCachedCompany(id, draft ?? base, previousId)

  return {
    status: 'done',
    id,
    base,
    draft,
    unlanded: leftover.filter(c => c.sync === 'api'),
    localOnly: leftover.filter(c => c.sync === 'local'),
    failures,
    verified,
  }
}

/**
 * Deletes a company everywhere. One that was never committed is only removed
 * locally. Throws if the API refuses — nothing is removed then, since a delete
 * that only happened locally would come back on the next fetch.
 */
export async function deleteCompanyEverywhere(company: CompanyFull): Promise<void> {
  if (!isNew(company)) {
    try {
      await deleteCompany(company.id)
    } catch (err) {
      throw new Error(`Could not delete: ${describeError(err)}.`, { cause: err })
    }
  }
  deleteLocalCompany(company.id)
  await patchCachedCompany(company.id, null)
}
