import { useEffect } from 'react'

interface UnsavedChangesModalProps {
  companyName: string
  onDiscard: () => void
  onStay: () => void
}

export function UnsavedChangesModal({ companyName, onDiscard, onStay }: UnsavedChangesModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onStay() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onStay])

  return (
    <div className="commit-overlay">
      <div className="unsaved-modal__dialog" role="dialog" aria-modal="true">
        <div className="unsaved-modal__header">
          <div className="label field">You have unsaved changes</div>
          <div className="hint">Changes to {companyName} will be lost if you leave now.</div>
        </div>
        <div className="unsaved-modal__footer">
          <button className="unsaved-modal__discard" onClick={onDiscard}>Discard and leave</button>
          <button className="unsaved-modal__stay" onClick={onStay}>Stay</button>
        </div>
      </div>
    </div>
  )
}
