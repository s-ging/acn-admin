import { memo, useCallback } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { useUIStore } from '../../../store/ui.store'
import { JSONImportDialog } from './JSONImportDialog'
import type { CompanyFull } from '../../../types/company.types'

export const JSONImportModal = memo(() => {
  const setDraft   = useCompanyStore(s => s.setDraft)
  const closeModal = useUIStore(s => s.closeModal)

  const handleLoad = useCallback((parsed: CompanyFull) => {
    setDraft(parsed)
    closeModal()
  }, [setDraft, closeModal])

  return (
    <div className="commit-overlay">
      <JSONImportDialog onClose={closeModal} onLoad={handleLoad} />
    </div>
  )
})

JSONImportModal.displayName = 'JSONImportModal'
