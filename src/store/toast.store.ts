import { create } from 'zustand'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  message: string
  type: ToastType
  leaving: boolean
}

interface ToastStore {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  dismiss: (id: string) => void
}

let seq = 0

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (message, type = 'info', duration = 3000) => {
    const id = String(++seq)
    set(state => ({ toasts: [...state.toasts, { id, message, type, leaving: false }] }))

    // begin exit transition 250ms before removal
    setTimeout(() => {
      set(state => ({
        toasts: state.toasts.map(t => t.id === id ? { ...t, leaving: true } : t)
      }))
    }, duration - 250)

    setTimeout(() => get().dismiss(id), duration)
  },

  dismiss: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}))
