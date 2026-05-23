import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '../../ui/Button'
import { DropZone } from '../../ui/DropZone'
import { UploadIcon } from '../../ui/UploadIcon'
import type { CompanyFull } from '../../../types/company.types'

type ImportState = 'upload' | 'summary' | 'success'

function validate(data: unknown): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  if (!data || typeof data !== 'object') return { valid: false, missing: ['entire record is invalid'] }
  const d = data as Record<string, unknown>
  if (typeof d.id !== 'number') missing.push('id')
  if (typeof d.name_en !== 'string' || !d.name_en) missing.push('name_en')
  if (!['active', 'inactive', 'draft'].includes(d.status as string)) missing.push('status')
  return { valid: missing.length === 0, missing }
}

export interface JSONImportDialogProps {
  onClose: () => void
  onLoad:  (company: CompanyFull) => void
}

export const JSONImportDialog = memo(({ onClose, onLoad }: JSONImportDialogProps) => {
  const [importState, setImportState] = useState<ImportState>('upload')
  const [parsed, setParsed]           = useState<CompanyFull | null>(null)
  const [filename, setFilename]       = useState('')
  const [error, setError]             = useState<string | null>(null)

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
    if (importState === 'success') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [importState, handleClose])

  const handleFile = useCallback((file: File) => {
    setError(null)
    setFilename(file.name)
    const reader = new FileReader()
    readerRef.current = reader
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text !== 'string') return
      try {
        const data: unknown = JSON.parse(text)
        const { valid, missing } = validate(data)
        if (!valid) {
          setError(`Missing required fields: ${missing.join(', ')}`)
          return
        }
        setParsed(data as CompanyFull)
        setImportState('summary')
      } catch {
        setError('Could not parse this file. Make sure it is a valid JSON file exported from ACN Portal.')
      }
    }
    reader.readAsText(file)
  }, [])

  const handleLoad = useCallback(() => {
    if (!parsed) return
    onLoad(parsed)
    setImportState('success')
    closeTimerRef.current = setTimeout(() => onClose(), 2000)
  }, [parsed, onLoad, onClose])

  return (
    <div className="commit-dialog json-import-dialog" role="dialog" aria-modal="true">
      <div className="commit-header">
        <div className="flex flex-col gap-1">
          <div className="label field">Import JSON</div>
          {importState !== 'success' && (
            <div className="hint">Load a company record from a JSON file. This will replace the current editor state.</div>
          )}
        </div>
        <button className="commit-close" onClick={handleClose} aria-label="Close">×</button>
      </div>

      {importState === 'upload' && (
        <>
          <div className="json-import__body">
            <DropZone accept=".json" onFile={handleFile}>
              <div className="logo-upload-zone__icon">
                <UploadIcon size={64} />
              </div>
              <p className="logo-upload-zone__text">
                Drop JSON file here or{' '}
                <span className="logo-upload-zone__link">browse from your computer.</span>
              </p>
              <p className="hint">File formats accepted: .json</p>
            </DropZone>
            {error && <div className="json-import__error">⚠ {error}</div>}
          </div>
          <div className="json-export__footer">
            <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
          </div>
        </>
      )}

      {importState === 'summary' && parsed && (
        <>
          <div className="json-import__body">
            <div className="json-import__file-ok">
              <span className="json-import__check">✓</span>
              <span className="hint">{filename}</span>
            </div>
            <div className="json-import__summary">
              <div className="label field">{parsed.name_en}</div>
              <div className="label">ID {parsed.id} · {parsed.status.charAt(0).toUpperCase() + parsed.status.slice(1)}</div>
              <div className="json-import__summary-rows">
                <div className="hint">{parsed.contacts?.length ?? 0} contacts</div>
                <div className="hint">{parsed.sectors?.length ?? 0} sectors</div>
                <div className="hint">{parsed.exchange_listings?.length ?? 0} exchange listings</div>
                <div className="hint">{parsed.wire_codes?.length ?? 0} wire codes</div>
              </div>
            </div>
            <div className="hint">⚠ This will replace the current editor state.</div>
          </div>
          <div className="json-export__footer">
            <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleLoad}>Load into editor →</Button>
          </div>
        </>
      )}

      {importState === 'success' && (
        <div className="json-import__success">
          <div className="json-import__success-icon">✓</div>
          <div className="label field">Loaded successfully.</div>
          <div className="hint">Your editor now reflects the imported record.</div>
          <div className="hint">Closing in a moment...</div>
        </div>
      )}
    </div>
  )
})

JSONImportDialog.displayName = 'JSONImportDialog'
