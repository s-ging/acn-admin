import { memo, useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useCompanyStore } from '../../../store/company.store'
import { useUIStore } from '../../../store/ui.store'
import { useToastStore } from '../../../store/toast.store'
import { CommitDialog } from './CommitDialog'
import { commitCompany, type ConflictChoice } from '../../../lib/companies/sync'
import type { Conflict } from '../../../lib/companies/diff'
import type { CommitMode } from './CommitDialog'

interface CommitModalProps {
  mode?: CommitMode
}

export const CommitModal = memo(({ mode = 'commit' }: CommitModalProps) => {
  const original    = useCompanyStore(s => s.original)
  const draft       = useCompanyStore(s => s.draft)
  const changes     = useCompanyStore(s => s.changes)
  const baseMissing = useCompanyStore(s => s.baseMissing)
  const resetDraft  = useCompanyStore(s => s.resetDraft)
  const committed   = useCompanyStore(s => s.committed)
  const closeModal  = useUIStore(s => s.closeModal)
  const addToast    = useToastStore(s => s.addToast)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const [reverted,   setReverted]   = useState(false)
  const [committing, setCommitting] = useState(false)
  const [conflicts,  setConflicts]  = useState<Conflict[] | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timer = closeTimer
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !reverted && !committing) closeModal()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closeModal, reverted, committing])

  // The draft is already saved locally (autosave). This sends it, re-fetches,
  // and keeps whatever did not land as the draft — see lib/companies/sync.ts.
  const runCommit = useCallback(async (choice?: ConflictChoice) => {
    if (!draft || committing) return
    setCommitting(true)
    try {
      const result = await commitCompany(baseMissing ? null : original, draft, choice)

      if (result.status === 'conflict') {
        setConflicts(result.conflicts)
        return
      }
      if (result.status === 'failed') {
        addToast(result.message, 'error', 8000)
        return
      }

      committed(result.base, result.draft)
      closeModal()
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      queryClient.removeQueries({ queryKey: ['company', draft.id] })

      const unlanded = result.unlanded.length
      const local = result.localOnly.length
      if (!result.verified) {
        addToast('Sent, but the API could not be re-read to confirm it. Your changes are kept as a draft until a commit is confirmed.', 'warning', 8000)
      } else if (unlanded) {
        addToast(
          `${unlanded} change${unlanded === 1 ? '' : 's'} did not show up in the API after saving` +
            (result.failures.length ? ` (${result.failures[0]})` : '') +
            '. They are kept as a draft.',
          'warning',
          8000
        )
      } else if (local) {
        addToast(`Saved to the newswire. ${local} change${local === 1 ? '' : 's'} with no API endpoint stay local.`, 'success', 6000)
      } else {
        addToast('Saved to the newswire.', 'success')
      }

      if (result.id !== draft.id) navigate(`/companies/${result.id}`, { replace: true })
    } finally {
      setCommitting(false)
    }
  }, [draft, original, baseMissing, committing, committed, closeModal, addToast, queryClient, navigate])

  const handleDiscard = useCallback(() => {
    resetDraft()
    setReverted(true)
    addToast('Draft discarded — back to the newswire version.', 'success')
    closeTimer.current = setTimeout(() => closeModal(), 2200)
  }, [resetDraft, addToast, closeModal])

  return (
    <div className="commit-overlay">
      <CommitDialog
        mode={mode}
        draft={draft}
        changes={changes}
        ready
        reverted={reverted}
        committing={committing}
        conflicts={conflicts}
        onClose={closeModal}
        onCommit={() => runCommit()}
        onResolve={choice => runCommit(choice)}
        onDiscard={handleDiscard}
      />
    </div>
  )
})

CommitModal.displayName = 'CommitModal'
