import { memo, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'

interface RichTextEditorProps {
  initialHTML: string
  onChange: (html: string) => void
  placeholder?: string
}

export const RichTextEditor = memo(({ initialHTML, onChange, placeholder }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' }
      }),
    ],
    content: initialHTML,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  return (
    <div className="rte">
      <div className="rte__toolbar">
        <button
          type="button"
          className={`rte__btn ${editor?.isActive('bold') ? 'rte__btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBold().run() }}
          disabled={!editor}
        >
          B
        </button>
        <button
          type="button"
          className={`rte__btn rte__btn--italic ${editor?.isActive('italic') ? 'rte__btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleItalic().run() }}
          disabled={!editor}
        >
          I
        </button>
        <button
          type="button"
          className={`rte__btn rte__btn--underline ${editor?.isActive('underline') ? 'rte__btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleUnderline().run() }}
          disabled={!editor}
        >
          U
        </button>
        <div className="rte__divider" />
        <button
          type="button"
          className={`rte__btn ${editor?.isActive('bulletList') ? 'rte__btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run() }}
          disabled={!editor}
        >
          ≡
        </button>
        <button
          type="button"
          className={`rte__btn ${editor?.isActive('orderedList') ? 'rte__btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleOrderedList().run() }}
          disabled={!editor}
        >
          1.
        </button>
        <div className="rte__divider" />
        <button
          type="button"
          className="rte__btn"
          onMouseDown={e => {
            e.preventDefault()
            const url = window.prompt('Enter URL')
            if (url) editor?.chain().focus().setLink({ href: url }).run()
          }}
          disabled={!editor}
        >
          🔗
        </button>
        <button
          type="button"
          className="rte__btn"
          onMouseDown={e => {
            e.preventDefault()
            editor?.chain().focus().unsetLink().run()
          }}
          disabled={!editor}
        >
          ✂
        </button>
      </div>
      <EditorContent
        editor={editor}
        className="rte__content"
        placeholder={placeholder}
      />
    </div>
  )
})

RichTextEditor.displayName = 'RichTextEditor'
