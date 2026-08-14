import { memo, useState, useCallback } from 'react'
import { Button } from './Button'
import { RichTextEditor } from './RichTextEditor'
import type { ToolbarVariant } from './RichTextEditor'

interface AboutBlockProps {
  label: string
  subtitle?: string
  html: string | null
  onChange: (html: string) => void
  /** Passed through to the editor. `basic` for boilerplate prose. */
  variant?: ToolbarVariant
  placeholder?: string
}

export const AboutBlock = memo(({ label, subtitle, html, onChange, variant, placeholder }: AboutBlockProps) => {
  const [editing, setEditing] = useState(false)
  const [localHTML, setLocalHTML] = useState(html ?? '')
  const [editorMounted, setEditorMounted] = useState(false)

  const handleSave = useCallback(() => {
    onChange(localHTML)
    setEditing(false)
  }, [localHTML, onChange])

  const handleCancel = useCallback(() => {
    setLocalHTML(html ?? '')
    setEditing(false)
  }, [html])

  const handleStartEdit = useCallback(() => {
    setEditorMounted(true)
    setEditing(true)
  }, [])

  return (
    <div className="about-block">
      <div className="about-block__header">
        <div>
          <span className="label field">{label}</span>
          {subtitle && <p className="hint">{subtitle}</p>}
        </div>
        {editing ? (
          <div className="about-block__actions">
            <Button variant="danger" size="sm" onClick={handleCancel}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave}>Save</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={handleStartEdit}>
            Edit
          </Button>
        )}
      </div>

      <div style={{ display: editing ? undefined : 'none' }}>
        {editorMounted && (
          <RichTextEditor
            initialHTML={localHTML}
            onChange={setLocalHTML}
            variant={variant}
            placeholder={placeholder}
          />
        )}
      </div>

      <div className="about-block__body" style={{ display: editing ? 'none' : undefined }}>
        {html
          ? <div dangerouslySetInnerHTML={{ __html: html }} />
          : <span className="about-block__empty">No content yet.</span>
        }
      </div>
    </div>
  )
})

AboutBlock.displayName = 'AboutBlock'
