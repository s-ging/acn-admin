import { memo, useCallback } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { useUIStore } from '../../../store/ui.store'
import { AnnualReportDialog } from './AnnualReportDialog'

export const AnnualReportModal = memo(() => {
  const updateDraft = useCompanyStore(s => s.updateDraft)
  const closeModal  = useUIStore(s => s.closeModal)

  const handleApply = useCallback((url: string, name: string, date: string, size: string) => {
    updateDraft({
      annual_report_url:  url,
      annual_report_name: name,
      annual_report_date: date,
      annual_report_size: size,
    })
  }, [updateDraft])

  return (
    <div className="commit-overlay">
      <AnnualReportDialog onClose={closeModal} onApply={handleApply} />
    </div>
  )
})

AnnualReportModal.displayName = 'AnnualReportModal'
