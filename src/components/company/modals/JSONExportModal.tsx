import { memo, useEffect } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { useUIStore } from '../../../store/ui.store'
import { JSONExportDialog } from './JSONExportDialog'

export const JSONExportModal = memo(() => {
  const draft      = useCompanyStore(s => s.draft)
  const closeModal = useUIStore(s => s.closeModal)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closeModal])

  return (
    <div className="commit-overlay">
      <JSONExportDialog draft={draft} onClose={closeModal} />
    </div>
  )
})

JSONExportModal.displayName = 'JSONExportModal'
