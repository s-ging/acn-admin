import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '../../ui/Button'
import { DropZone } from '../../ui/DropZone'
import { UploadIcon } from '../../ui/UploadIcon'

type ReportState = 'upload' | 'review' | 'success'

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

export interface AnnualReportDialogProps {
  onClose: () => void
  onApply: (url: string, name: string, date: string, size: string) => void
}

export const AnnualReportDialog = memo(({ onClose, onApply }: AnnualReportDialogProps) => {
  const [reportState, setReportState] = useState<ReportState>('upload')
  const [filename, setFilename]       = useState('')
  const [dataUrl, setDataUrl]         = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [reportName, setReportName]   = useState('')
  const [reportDate, setReportDate]   = useState('')
  const [reportSize, setReportSize]   = useState('')

  const readerRef     = useRef<FileReader | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      readerRef.current?.abort()
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const handleClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (reportState === 'success') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [reportState, handleClose])

  const handleFile = useCallback((file: File) => {
    setError(null)
    const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (ext !== '.pdf') {
      setError('Only .pdf files are accepted.')
      return
    }
    setFilename(file.name)
    setReportName(file.name)
    setReportSize(formatSize(file.size))
    setReportDate('')
    const reader = new FileReader()
    readerRef.current = reader
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result !== 'string') return
      setDataUrl(result)
      setReportState('review')
    }
    reader.readAsDataURL(file)
  }, [])

  const handleApply = useCallback(() => {
    onApply(dataUrl, reportName, reportDate, reportSize)
    setReportState('success')
    closeTimerRef.current = setTimeout(() => onClose(), 2000)
  }, [dataUrl, reportName, reportDate, reportSize, onApply, onClose])

  return (
    <div className="commit-dialog annual-report-dialog" role="dialog" aria-modal="true">
      <div className="commit-header">
        <div className="flex flex-col gap-1">
          <div className="label field">Upload Annual Report</div>
          {reportState !== 'success' && (
            <div className="hint">Attach a PDF. The name, date, and size will update on the company record.</div>
          )}
        </div>
        <button className="commit-close" onClick={handleClose} aria-label="Close">×</button>
      </div>

      {reportState === 'upload' && (
        <>
          <div className="json-import__body">
            <DropZone accept=".pdf" onFile={handleFile}>
              <div className="logo-upload-zone__icon">
                <UploadIcon size={64} />
              </div>
              <p className="logo-upload-zone__text">
                Drop PDF file here or{' '}
                <span className="logo-upload-zone__link">browse from your computer.</span>
              </p>
              <p className="hint">File formats accepted: .pdf</p>
            </DropZone>
            {error && <div className="json-import__error">⚠ {error}</div>}
          </div>
          <div className="json-export__footer">
            <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
          </div>
        </>
      )}

      {reportState === 'review' && (
        <>
          <div className="json-import__body">
            <div className="json-import__file-ok">
              <span className="json-import__check">✓</span>
              <span className="hint">{filename}</span>
            </div>
            <div className="annual-report__fields">
              <div className="field">
                <span className="label field">Report name</span>
                <input
                  className="field__input"
                  value={reportName}
                  onChange={e => setReportName(e.target.value)}
                  placeholder="Annual Report 2024"
                />
              </div>
              <div className="annual-report__field-row">
                <div className="field">
                  <span className="label field">Date</span>
                  <input
                    type="date"
                    className="field__input"
                    value={reportDate}
                    onChange={e => setReportDate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <span className="label field">Size</span>
                  <input
                    className="field__input field__input--muted"
                    value={reportSize}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
              </div>
            </div>
            <div className="hint">⚠ This will update the annual report on the company record.</div>
          </div>
          <div className="json-export__footer">
            <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleApply}>Apply to record →</Button>
          </div>
        </>
      )}

      {reportState === 'success' && (
        <div className="json-import__success">
          <div className="json-import__success-icon">✓</div>
          <div className="label field">Report attached.</div>
          <div className="hint">The annual report fields have been updated.</div>
          <div className="hint">Closing in a moment...</div>
        </div>
      )}
    </div>
  )
})

AnnualReportDialog.displayName = 'AnnualReportDialog'
