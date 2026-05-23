import { memo } from 'react'
import { useToastStore } from '../../store/toast.store'
import type { Toast as ToastItem } from '../../store/toast.store'

const ICONS: Record<ToastItem['type'], string> = {
  info:    '●',
  success: '✓',
  warning: '⚠',
  error:   '✕',
}

const ToastEl = memo(({ toast }: { toast: ToastItem }) => {
  const dismiss = useToastStore(s => s.dismiss)
  return (
    <div
      className={`toast toast--${toast.type}${toast.leaving ? ' toast--leaving' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="toast__icon">{ICONS[toast.type]}</span>
      <span className="toast__message">{toast.message}</span>
      <button className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">×</button>
    </div>
  )
})
ToastEl.displayName = 'ToastEl'

export const ToastContainer = memo(() => {
  const toasts = useToastStore(s => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div className="toast-container" aria-label="Notifications">
      {toasts.map(t => <ToastEl key={t.id} toast={t} />)}
    </div>
  )
})
ToastContainer.displayName = 'ToastContainer'
