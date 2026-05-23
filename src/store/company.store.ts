import { create } from 'zustand'
import type { CompanyFull, Change } from '../types/company.types'

interface CompanyStore {
  original: CompanyFull | null
  draft: CompanyFull | null
  changes: Change[]
  resetCount: number
  setOriginal: (company: CompanyFull) => void
  updateDraft: (patch: Partial<CompanyFull>) => void
  computeChanges: () => void
  resetDraft: () => void
  commitSuccess: () => void
}

export const useCompanyStore = create<CompanyStore>((set, get) => ({
  original: null,
  draft: null,
  changes: [],
  resetCount: 0,

  setOriginal: (company) => set({
    original: company,
    draft: structuredClone(company)
  }),

  updateDraft: (patch) => set(state => ({
    draft: state.draft ? { ...state.draft, ...patch } : null
  })),

  computeChanges: () => {
    const { original, draft } = get()
    if (!original || !draft) return
    import('../lib/companies/diff').then(({ computeDiff }) => {
      set({ changes: computeDiff(original, draft) })
    })
  },

  resetDraft: () => set(state => ({
    draft: state.original ? structuredClone(state.original) : null,
    changes: [],
    resetCount: state.resetCount + 1
  })),

  commitSuccess: () => set(state => ({
    original: state.draft,
    changes: []
  }))
}))
