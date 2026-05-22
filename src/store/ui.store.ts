import { create } from 'zustand'
import type { Tab, Modal } from '../types/company.types'

interface UIStore {
  activeTab: Tab
  openAccordions: Set<number>
  activeModal: Modal
  csvImportTarget: string | null

  setTab: (tab: Tab) => void
  toggleAccordion: (id: number) => void
  openModal: (modal: Modal, target?: string) => void
  closeModal: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  activeTab: 'basic-info',
  openAccordions: new Set(),
  activeModal: null,
  csvImportTarget: null,

  setTab: (tab) => set({ activeTab: tab }),

  toggleAccordion: (id) => set(state => {
    const next = new Set(state.openAccordions)
    next.has(id) ? next.delete(id) : next.add(id)
    return { openAccordions: next }
  }),

  openModal: (modal, target) => set({
    activeModal: modal,
    csvImportTarget: target ?? null
  }),

  closeModal: () => set({ activeModal: null, csvImportTarget: null })
}))
