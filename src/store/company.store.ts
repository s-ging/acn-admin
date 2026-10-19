import { create } from 'zustand'
import { diffCompany, type CompanyChange } from '../lib/companies/diff'
import { deleteDraft, saveDraft } from '../lib/companies/storage'
import type { CompanyFull } from '../types/company.types'

// The editor's state is two records and the diff between them:
//
//   original — the API version (the base). Only `open` and `committed` set it.
//   draft    — the user's working copy. Every change is autosaved to
//              localStorage as the company's draft, and the draft is deleted
//              again the moment it matches the base.
//   changes  — diffCompany(original, draft), recomputed on every edit. The same
//              change set the commit sends — see lib/companies/diff.ts.

interface CompanyStore {
  original: CompanyFull | null
  draft: CompanyFull | null
  changes: CompanyChange[]
  /**
   * True when `original` is a stand-in — the company was opened offline with no
   * API version cached. The commit then diffs against a fresh fetch instead.
   */
  baseMissing: boolean
  /** Set when the last autosave failed (quota) — the edit lives only in memory. */
  saveError: string | null
  resetCount: number
  /** Opens a company: its base, and the draft on top of it if one exists. */
  open: (base: CompanyFull, draft?: CompanyFull | null, baseMissing?: boolean) => void
  /** @deprecated Use `open`. Kept for the dev seed/preview screens. */
  setOriginal: (company: CompanyFull) => void
  setDraft: (company: CompanyFull) => void
  updateDraft: (patch: Partial<CompanyFull>) => void
  /** Kept for callers that ask; changes are always current now. */
  computeChanges: () => void
  /** Drops the draft — local copy included — back to the base. */
  resetDraft: () => void
  /** After a commit: the re-fetched base, and whatever is still uncommitted. */
  committed: (base: CompanyFull, draft: CompanyFull | null) => void
}

function persist(original: CompanyFull | null, draft: CompanyFull, baseMissing: boolean): { changes: CompanyChange[]; saveError: string | null } {
  const changes = original ? diffCompany(original, draft) : []
  try {
    // Kept whenever it can't be shown to match a real base: a company created
    // here has none, and a stand-in base matches the draft by construction.
    if (changes.length || draft.created_at || baseMissing) saveDraft(draft)
    else deleteDraft(draft.id)
    return { changes, saveError: null }
  } catch {
    return { changes, saveError: 'Browser storage is full — this edit is not saved locally.' }
  }
}

export const useCompanyStore = create<CompanyStore>((set, get) => ({
  original: null,
  draft: null,
  changes: [],
  baseMissing: false,
  saveError: null,
  resetCount: 0,

  open: (base, draft = null, baseMissing = false) => {
    const working = structuredClone(draft ?? base)
    set({
      original: base,
      draft: working,
      changes: diffCompany(base, working),
      baseMissing,
      saveError: null,
    })
  },

  setOriginal: (company) => get().open(company),

  setDraft: (company) => {
    const draft = structuredClone(company)
    set({ draft, ...persist(get().original, draft, get().baseMissing) })
  },

  updateDraft: (patch) => {
    const current = get().draft
    if (!current) return
    const draft = { ...current, ...patch }
    set({ draft, ...persist(get().original, draft, get().baseMissing) })
  },

  computeChanges: () => {
    const { original, draft } = get()
    if (original && draft) set({ changes: diffCompany(original, draft) })
  },

  resetDraft: () => {
    const { original, draft } = get()
    if (draft) deleteDraft(draft.id)
    // A company created here is still one after a discard: keep the marker that
    // makes its first commit a create, not an update of a company that isn't there.
    const reset = original && draft?.created_at
      ? { ...structuredClone(original), created_at: draft.created_at }
      : original ? structuredClone(original) : null
    set(state => ({
      draft: reset,
      changes: [],
      saveError: null,
      resetCount: state.resetCount + 1,
    }))
  },

  committed: (base, draft) => {
    const working = structuredClone(draft ?? base)
    set(state => ({
      original: base,
      draft: working,
      changes: diffCompany(base, working),
      baseMissing: false,
      saveError: null,
      resetCount: state.resetCount + 1,
    }))
  },
}))
