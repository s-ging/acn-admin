import { memo, useEffect, useRef, useState, useCallback } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { useUIStore } from '../../../store/ui.store'
import { useToastStore } from '../../../store/toast.store'
import { CommitDialog } from './CommitDialog'
import type { CommitMode } from './CommitDialog'

interface CommitModalProps {
  mode?: CommitMode
}

export const CommitModal = memo(({ mode = 'commit' }: CommitModalProps) => {
  const draft          = useCompanyStore(s => s.draft)
  const changes        = useCompanyStore(s => s.changes)
  const computeChanges = useCompanyStore(s => s.computeChanges)
  const resetDraft     = useCompanyStore(s => s.resetDraft)
  const commitSuccess  = useCompanyStore(s => s.commitSuccess)
  const closeModal     = useUIStore(s => s.closeModal)
  const addToast       = useToastStore(s => s.addToast)

  const [ready,    setReady]    = useState(false)
  const [reverted, setReverted] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    computeChanges()
    const t = setTimeout(() => setReady(true), 400)
    return () => clearTimeout(t)
  }, [computeChanges])

  // Set ready immediately when the async computeChanges resolves — avoids a race
  // where the 400ms fallback fires before the dynamic import finishes on cold load
  useEffect(() => {
    if (changes.length > 0) setReady(true)
  }, [changes])

  useEffect(() => {
    const timer = closeTimer
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !reverted) closeModal()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closeModal, reverted])

  const handleCommit = useCallback(() => {
    if (draft) {
      const urlVal = draft.annual_report_url
      console.log('[CommitModal] handleCommit — annual_report_url:', urlVal ? `${urlVal.slice(0, 80)}… (len=${urlVal.length})` : urlVal)
      const toSave = urlVal?.startsWith('data:')
        ? { ...draft, annual_report_url: null }
        : draft
      try {
        localStorage.setItem(`acn_company_${draft.id}`, JSON.stringify(toSave))
        console.log('[CommitModal] localStorage.setItem succeeded')
      } catch (err) {
        console.error('[CommitModal] localStorage.setItem FAILED:', err)
      }
    }
    commitSuccess()
    closeModal()
  }, [draft, commitSuccess, closeModal])

  const handleDiscard = useCallback(() => {
    resetDraft()
    setReverted(true)
    addToast('No changes recorded. Your data is safe.', 'success')
    closeTimer.current = setTimeout(() => closeModal(), 2200)
  }, [resetDraft, addToast, closeModal])

  return (
    <div className="commit-overlay">
      <CommitDialog
        mode={mode}
        draft={draft}
        changes={changes}
        ready={ready}
        reverted={reverted}
        onClose={closeModal}
        onCommit={handleCommit}
        onDiscard={handleDiscard}
      />
    </div>
  )
})

CommitModal.displayName = 'CommitModal'
