import { create } from 'zustand'
import type { CompanyFull, Change } from '../types/company.types'

interface CompanyStore {
  original: CompanyFull | null
  draft: CompanyFull | null
  changes: Change[]
  setOriginal: (company: CompanyFull) => void
  updateDraft: (patch: Partial<CompanyFull>) => void
  computeChanges: () => void
  resetDraft: () => void
  commitSuccess: () => void
}

export const useCompanyStore = create<CompanyStore>((set, _get) => ({
  original: null,
  draft: null,
  changes: [],

  setOriginal: (company) => set({
    original: company,
    draft: structuredClone(company)
  }),

  updateDraft: (patch) => set(state => ({
    draft: state.draft ? { ...state.draft, ...patch } : null
  })),

  computeChanges: () => {
    // v2 — diff engine not implemented yet
    set({ changes: [] })
  },

  resetDraft: () => set(state => ({
    draft: state.original ? structuredClone(state.original) : null,
    changes: []
  })),

  commitSuccess: () => set(state => ({
    original: state.draft,
    changes: []
  }))
}))
