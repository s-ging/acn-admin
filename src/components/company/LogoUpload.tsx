import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { useCompanyStore } from '../../store/company.store'
import { TrashIcon } from '../ui/TrashIcon'
import { DropZone } from '../ui/DropZone'
import { ImageIcon } from '../ui/ImageIcon'

const ACCEPT = '.svg,.png,.jpg,.jpeg,.gif,.webp'
const ACCEPTED_EXTS = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']
const MAX_BYTES = 3 * 1024 * 1024

interface LogoUploadProps {
  companyId: number
  field: 'logo_article_url' | 'logo_top_url'
  label: string
}

function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

export const LogoUpload = memo(({ companyId, field, label }: LogoUploadProps) => {
  const draft       = useCompanyStore(s => s.draft)
  const updateDraft = useCompanyStore(s => s.updateDraft)

  const [error, setError]       = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null)
  const readerRef               = useRef<FileReader | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(`acn_logo_${field}_${companyId}`)
    if (!stored) return
    if (!useCompanyStore.getState().draft?.[field]) {
      if (field === 'logo_article_url') updateDraft({ logo_article_url: stored })
      else updateDraft({ logo_top_url: stored })
    }
  }, [companyId, field, updateDraft])

  useEffect(() => {
    return () => { readerRef.current?.abort() }
  }, [])

  const preview = draft?.[field] ?? null

  const handleFile = useCallback((file: File) => {
    setError(null)
    const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (!ACCEPTED_EXTS.includes(ext)) {
      setError('Accepted formats: .svg, .png, .jpg, .gif, .webp')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('File exceeds 3MB limit.')
      return
    }
    setFileInfo({ name: file.name, size: file.size })
    const reader = new FileReader()
    readerRef.current = reader
    reader.onload = (e) => {
      const dataUrl = e.target?.result
      if (typeof dataUrl !== 'string') return
      if (field === 'logo_article_url') updateDraft({ logo_article_url: dataUrl })
      else updateDraft({ logo_top_url: dataUrl })
      localStorage.setItem(`acn_logo_${field}_${companyId}`, dataUrl)
    }
    reader.readAsDataURL(file)
  }, [field, companyId, updateDraft])

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (field === 'logo_article_url') updateDraft({ logo_article_url: null })
    else updateDraft({ logo_top_url: null })
    localStorage.removeItem(`acn_logo_${field}_${companyId}`)
    setFileInfo(null)
    setError(null)
  }, [field, companyId, updateDraft])

  return (
    <div className="logo-upload-zone">
      <span className="label field">{label}</span>
      <DropZone accept={ACCEPT} onFile={handleFile} className={preview ? 'drop-zone--filled' : undefined}>
        {preview ? (
          <>
            <div className="logo-upload__preview">
              <img src={preview} alt={label} />
            </div>
            <div className="logo-upload__meta">
              <span className="label field">
                {fileInfo?.name ?? 'Uploaded logo'}{fileInfo ? ` · ${formatKB(fileInfo.size)}` : ''}
              </span>
              <button className="logo-upload__remove" onClick={handleRemove} aria-label="Remove logo">
                <TrashIcon />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="logo-upload-zone__icon">
              <ImageIcon size={64} />
            </div>
            <p className="logo-upload-zone__text">
              Drag and drop image files here or{' '}
              <span className="logo-upload-zone__link">upload files from your computer.</span>
            </p>
            <p className="hint">File formats: .svg, .png, .jpg, .gif, .webp · Max 3MB</p>
          </>
        )}
      </DropZone>
      {error && <div className="logo-upload__error">{error}</div>}
    </div>
  )
})

LogoUpload.displayName = 'LogoUpload'
