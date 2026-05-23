import { memo } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { useUIStore } from '../../../store/ui.store'
import { JSONImportDialog } from './JSONImportDialog'

export const JSONImportModal = memo(() => {
  const setOriginal = useCompanyStore(s => s.setOriginal)
  const closeModal  = useUIStore(s => s.closeModal)

  return (
    <div className="commit-overlay">
      <JSONImportDialog onClose={closeModal} onLoad={setOriginal} />
    </div>
  )
})

JSONImportModal.displayName = 'JSONImportModal'
