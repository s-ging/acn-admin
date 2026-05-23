import { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../../../store/company.store'
import { useUIStore } from '../../../store/ui.store'
import { JSONImportDialog } from './JSONImportDialog'
import type { CompanyFull } from '../../../types/company.types'

export const JSONImportModal = memo(() => {
  const original    = useCompanyStore(s => s.original)
  const setOriginal = useCompanyStore(s => s.setOriginal)
  const closeModal  = useUIStore(s => s.closeModal)
  const navigate    = useNavigate()

  const handleLoad = useCallback((parsed: CompanyFull) => {
    if (original && original.id !== parsed.id) {
      localStorage.removeItem(`acn_company_${original.id}`)
    }
    localStorage.setItem(`acn_company_${parsed.id}`, JSON.stringify(parsed))
    setOriginal(parsed)
    closeModal()
    navigate(`/companies/${parsed.id}`)
  }, [original, setOriginal, closeModal, navigate])

  return (
    <div className="commit-overlay">
      <JSONImportDialog onClose={closeModal} onLoad={handleLoad} />
    </div>
  )
})

JSONImportModal.displayName = 'JSONImportModal'
