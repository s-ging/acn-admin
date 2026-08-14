import { memo, useState, useCallback } from 'react'
import { DropZone } from '../DropZone'
import { ImageIcon } from '../ImageIcon'
import { Button } from '../Button'
import { Field } from '../Field'

const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.svg'
const ACCEPTED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']

// Deliberately tighter than LogoUpload's 3MB. An uploaded image is inlined into
// body_html as a data URL, base64 inflates it by about a third, and the whole
// article goes into localStorage under a ~5MB origin quota — a release with
// several 3MB images would not save at all. Linking by URL has no such limit.
const MAX_BYTES = 1024 * 1024

export interface InsertImagePayload {
  src: string
  alt: string | null
}

interface ImageDialogProps {
  onInsert: (payload: InsertImagePayload) => void
  onClose: () => void
}

function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`
}

/**
 * Insert an image either by URL or by uploading a file.
 *
 * URL is offered first and on purpose: a hosted image keeps the release small,
 * where an upload is inlined as base64 and counts against the storage quota.
 */
export const ImageDialog = memo(({ onInsert, onClose }: ImageDialogProps) => {
  const [url, setUrl] = useState('')
  const [alt, setAlt] = useState('')
  const [uploaded, setUploaded] = useState<{ dataUrl: string; name: string; size: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    setError(null)
    const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (!ACCEPTED_EXTS.includes(ext)) {
      setError('Accepted formats: .png, .jpg, .gif, .webp, .svg')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`${formatKB(file.size)} is over the 1MB limit for an inline image. Host it and paste the URL instead.`)
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result
      if (typeof dataUrl !== 'string') return
      setUploaded({ dataUrl, name: file.name, size: file.size })
      setUrl('')
    }
    reader.readAsDataURL(file)
  }, [])

  const src = uploaded?.dataUrl ?? url.trim()
  const canInsert = src.length > 0

  const handleInsert = () => {
    if (!canInsert) return
    onInsert({ src, alt: alt.trim() || null })
  }

  return (
    <div className="commit-overlay" onClick={onClose}>
      <div
        className="commit-dialog json-import-dialog"
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        <div className="commit-header">
          <div className="commit-header__text">
            <span className="label field">Insert image</span>
            <span className="hint">Link to a hosted image, or upload one to embed.</span>
          </div>
          <button className="commit-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="commit-body">
          <Field
            label="Image URL"
            value={url}
            placeholder="https://…"
            disabled={!!uploaded}
            hint={uploaded ? 'Remove the uploaded file to link by URL instead.' : 'Preferred — keeps the release small.'}
            onChange={e => setUrl(e.target.value)}
          />

          <div style={{ marginTop: 16 }}>
            <DropZone
              accept={ACCEPT}
              onFile={handleFile}
              className={uploaded ? 'drop-zone--filled' : undefined}
            >
              {uploaded ? (
                <>
                  <div className="logo-upload__preview">
                    <img src={uploaded.dataUrl} alt={alt || uploaded.name} />
                  </div>
                  <div className="logo-upload__meta">
                    <span className="label field">
                      {uploaded.name} · {formatKB(uploaded.size)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={e => { e.stopPropagation(); setUploaded(null) }}
                    >
                      Remove
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="logo-upload-zone__icon"><ImageIcon size={48} /></div>
                  <p className="logo-upload-zone__text">
                    Drag an image here or{' '}
                    <span className="logo-upload-zone__link">upload from your computer.</span>
                  </p>
                  <p className="hint">.png, .jpg, .gif, .webp, .svg · Max 1MB, embedded in the release</p>
                </>
              )}
            </DropZone>
          </div>

          {error && <div className="logo-upload__error" style={{ marginTop: 8 }}>{error}</div>}

          <div style={{ marginTop: 16 }}>
            <Field
              label="Alt text"
              value={alt}
              placeholder="Describes the image to screen readers and when it fails to load"
              onChange={e => setAlt(e.target.value)}
            />
          </div>
        </div>

        <div className="commit-footer">
          <div className="commit-footer__actions">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={!canInsert} onClick={handleInsert}>
              Insert image
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})

ImageDialog.displayName = 'ImageDialog'
