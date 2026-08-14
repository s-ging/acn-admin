import { create } from 'zustand'
import type { PressRelease } from '../types/press-release.types'

interface ArticleStore {
  original: PressRelease | null
  draft: PressRelease | null
  resetCount: number
  setOriginal: (article: PressRelease) => void
  setDraft: (article: PressRelease) => void
  updateDraft: (patch: Partial<PressRelease>) => void
  resetDraft: () => void
  commitSuccess: () => void
}

export const useArticleStore = create<ArticleStore>((set) => ({
  original: null,
  draft: null,
  resetCount: 0,

  setOriginal: (article) => set({
    original: article,
    draft: structuredClone(article)
  }),

  setDraft: (article) => set({
    draft: structuredClone(article)
  }),

  updateDraft: (patch) => set(state => ({
    draft: state.draft ? { ...state.draft, ...patch } : null
  })),

  // Bumping resetCount remounts the canvas and the panel, which is what flushes
  // the uncontrolled inputs — see the note on pattern A in the style reference.
  resetDraft: () => set(state => ({
    draft: state.original ? structuredClone(state.original) : null,
    resetCount: state.resetCount + 1
  })),

  commitSuccess: () => set(state => ({
    original: state.draft ? structuredClone(state.draft) : null
  }))
}))
