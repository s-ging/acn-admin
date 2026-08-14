import { memo, useCallback, useState } from 'react'
import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import { buildExtensions } from './rte/extensions'
import type { ToolbarVariant } from './rte/extensions'
import { RichTextToolbar } from './rte/RichTextToolbar'
import { ImageDialog } from './rte/ImageDialog'
import type { InsertImagePayload } from './rte/ImageDialog'

export type { ToolbarVariant }

interface RichTextEditorProps {
  initialHTML: string
  onChange: (html: string) => void
  placeholder?: string
  /**
   * `full` (default) — images, tables, alignment, headings. For release bodies.
   * `basic` — text and links only. For a paragraph of boilerplate.
   */
  variant?: ToolbarVariant
}

export const RichTextEditor = memo(({
  initialHTML,
  onChange,
  placeholder,
  variant = 'full',
}: RichTextEditorProps) => {
  const [imageDialogOpen, setImageDialogOpen] = useState(false)

  const editor = useEditor({
    extensions: buildExtensions(variant, placeholder),
    content: initialHTML,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Counts live on editor storage, which only changes on transactions — so
  // they have to be read through useEditorState, same as the toolbar.
  const counts = useEditorState({
    editor,
    selector: ({ editor }) => ({
      words: editor.storage.characterCount.words(),
      characters: editor.storage.characterCount.characters(),
    }),
  })

  const handleInsertImage = useCallback((payload: InsertImagePayload) => {
    editor?.chain().focus().setImage({
      src: payload.src,
      ...(payload.alt ? { alt: payload.alt } : {}),
    }).run()
    setImageDialogOpen(false)
  }, [editor])

  return (
    <div className="rte">
      {editor && (
        <RichTextToolbar
          editor={editor}
          variant={variant}
          onRequestImage={() => setImageDialogOpen(true)}
        />
      )}

      <EditorContent editor={editor} className="rte__content" />

      {counts && (
        <div className="rte__footer">
          <span className="hint">
            {counts.words} {counts.words === 1 ? 'word' : 'words'} · {counts.characters} characters
          </span>
        </div>
      )}

      {imageDialogOpen && (
        <ImageDialog
          onInsert={handleInsertImage}
          onClose={() => setImageDialogOpen(false)}
        />
      )}
    </div>
  )
})

RichTextEditor.displayName = 'RichTextEditor'
