import { memo, useState, useCallback } from 'react'
import { Button } from '../../ui/Button'
import type { CompanyFull } from '../../../types/company.types'

export interface JSONExportDialogProps {
  draft: CompanyFull | null
  onClose: () => void
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export const JSONExportDialog = memo(({ draft, onClose }: JSONExportDialogProps) => {
  const [copied, setCopied] = useState(false)

  const json = draft ? JSON.stringify(draft, null, 2) : '{}'

  const handleDownload = useCallback(() => {
    if (!draft) return
    const filename = `company_${draft.id}_${slugify(draft.name_en)}.json`
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [draft, json])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [json])

  return (
    <div className="commit-dialog" role="dialog" aria-modal="true">
      <div className="commit-header">
        <div className="flex flex-col gap-1">
          <div className="label field">Export — {draft?.name_en ?? ''}</div>
          <div className="hint">Full company record as JSON. Re-import this file to create or update a company record.</div>
        </div>
        <button className="commit-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <pre className="json-export__preview">{json}</pre>

      <div className="json-export__footer">
        <Button variant="outline" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </Button>
        <Button variant="primary" onClick={handleDownload}>Download JSON →</Button>
      </div>
    </div>
  )
})

JSONExportDialog.displayName = 'JSONExportDialog'
