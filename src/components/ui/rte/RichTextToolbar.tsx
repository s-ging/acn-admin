import { memo } from 'react'
import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { IMAGE_ALIGNMENTS } from './extensions'
import type { ImageAlign, ToolbarVariant } from './extensions'

interface RichTextToolbarProps {
  editor: Editor
  variant: ToolbarVariant
  onRequestImage: () => void
}

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3'

/** Alignment glyphs. No unicode character reads as "align right" clearly enough. */
function AlignIcon({ align }: { align: 'left' | 'center' | 'right' | 'justify' }) {
  // Each row is [x, width] as a fraction of the 14px box.
  const rows: Record<string, [number, number][]> = {
    left:    [[1, 12], [1, 7], [1, 12], [1, 7]],
    center:  [[1, 12], [3.5, 7], [1, 12], [3.5, 7]],
    right:   [[1, 12], [6, 7], [1, 12], [6, 7]],
    justify: [[1, 12], [1, 12], [1, 12], [1, 12]],
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {rows[align].map(([x, w], i) => (
        <rect key={i} x={x} y={2 + i * 3} width={w} height="1.5" rx="0.5" fill="currentColor" />
      ))}
    </svg>
  )
}

function TableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1" y="2" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 5.5h12M5.5 5.5V12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function PictureIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1" y="2" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="5" cy="5.5" r="1.1" fill="currentColor" />
      <path d="M2 10.5l3-3 2.5 2.5L9.5 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Buttons use onMouseDown + preventDefault so the editor never loses selection. */
function ToolButton({ active, disabled, title, onRun, className, children }: {
  active?: boolean
  disabled?: boolean
  title: string
  onRun: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      className={`rte__btn${className ? ` ${className}` : ''}${active ? ' rte__btn--active' : ''}`}
      onMouseDown={e => { e.preventDefault(); onRun() }}
    >
      {children}
    </button>
  )
}

export const RichTextToolbar = memo(({ editor, variant, onRequestImage }: RichTextToolbarProps) => {
  // useEditor does NOT re-render on transactions in TipTap v3, so every active
  // state below has to come through useEditorState or the toolbar goes stale.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      blockquote: editor.isActive('blockquote'),
      codeBlock: editor.isActive('codeBlock'),
      link: editor.isActive('link'),
      blockType: (editor.isActive('heading', { level: 1 }) ? 'h1'
        : editor.isActive('heading', { level: 2 }) ? 'h2'
        : editor.isActive('heading', { level: 3 }) ? 'h3'
        : 'paragraph') as BlockType,
      alignLeft: editor.isActive({ textAlign: 'left' }),
      alignCenter: editor.isActive({ textAlign: 'center' }),
      alignRight: editor.isActive({ textAlign: 'right' }),
      alignJustify: editor.isActive({ textAlign: 'justify' }),
      imageSelected: editor.isActive('image'),
      imageAlign: (editor.getAttributes('image').align ?? null) as ImageAlign | null,
      imageAlt: (editor.getAttributes('image').alt ?? '') as string,
      inTable: editor.isActive('table'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
      linkHref: (editor.getAttributes('link').href ?? '') as string,
    }),
  })

  if (!state) return null

  const chain = () => editor.chain().focus()

  const setBlockType = (value: BlockType) => {
    if (value === 'paragraph') chain().setParagraph().run()
    else chain().setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run()
  }

  const setLink = () => {
    const url = window.prompt('Link URL', state.linkHref)
    if (url === null) return
    if (url.trim() === '') chain().unsetLink().run()
    else chain().setLink({ href: url.trim() }).run()
  }

  const full = variant === 'full'

  return (
    <>
      <div className="rte__toolbar">
        <ToolButton title="Undo" disabled={!state.canUndo} onRun={() => chain().undo().run()}>↶</ToolButton>
        <ToolButton title="Redo" disabled={!state.canRedo} onRun={() => chain().redo().run()}>↷</ToolButton>

        <div className="rte__divider" />

        <select
          className="rte__select"
          title="Text style"
          aria-label="Text style"
          value={state.blockType}
          onChange={e => setBlockType(e.target.value as BlockType)}
        >
          <option value="paragraph">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        <div className="rte__divider" />

        <ToolButton title="Bold" active={state.bold} onRun={() => chain().toggleBold().run()}>B</ToolButton>
        <ToolButton title="Italic" active={state.italic} className="rte__btn--italic" onRun={() => chain().toggleItalic().run()}>I</ToolButton>
        <ToolButton title="Underline" active={state.underline} className="rte__btn--underline" onRun={() => chain().toggleUnderline().run()}>U</ToolButton>
        <ToolButton title="Strikethrough" active={state.strike} className="rte__btn--strike" onRun={() => chain().toggleStrike().run()}>S</ToolButton>
        <ToolButton title="Inline code" active={state.code} onRun={() => chain().toggleCode().run()}>{'</>'}</ToolButton>

        <div className="rte__divider" />

        <ToolButton title="Align left" active={state.alignLeft} onRun={() => chain().setTextAlign('left').run()}><AlignIcon align="left" /></ToolButton>
        <ToolButton title="Align centre" active={state.alignCenter} onRun={() => chain().setTextAlign('center').run()}><AlignIcon align="center" /></ToolButton>
        <ToolButton title="Align right" active={state.alignRight} onRun={() => chain().setTextAlign('right').run()}><AlignIcon align="right" /></ToolButton>
        <ToolButton title="Justify" active={state.alignJustify} onRun={() => chain().setTextAlign('justify').run()}><AlignIcon align="justify" /></ToolButton>
      </div>

      <div className="rte__toolbar rte__toolbar--secondary">
        <ToolButton title="Bullet list" active={state.bulletList} onRun={() => chain().toggleBulletList().run()}>≡</ToolButton>
        <ToolButton title="Numbered list" active={state.orderedList} onRun={() => chain().toggleOrderedList().run()}>1.</ToolButton>
        <ToolButton title="Quote" active={state.blockquote} onRun={() => chain().toggleBlockquote().run()}>❝</ToolButton>
        <ToolButton title="Code block" active={state.codeBlock} onRun={() => chain().toggleCodeBlock().run()}>{'{ }'}</ToolButton>
        <ToolButton title="Horizontal rule" onRun={() => chain().setHorizontalRule().run()}>—</ToolButton>

        <div className="rte__divider" />

        <ToolButton title="Link" active={state.link} onRun={setLink}>🔗</ToolButton>
        <ToolButton title="Remove link" disabled={!state.link} onRun={() => chain().unsetLink().run()}>✂</ToolButton>

        {full && (
          <>
            <div className="rte__divider" />
            <ToolButton title="Insert image" onRun={onRequestImage}><PictureIcon /></ToolButton>
            <ToolButton
              title="Insert table"
              onRun={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            >
              <TableIcon />
            </ToolButton>
          </>
        )}
      </div>

      {/* Contextual bars — only what applies to what's selected right now. */}
      {full && state.imageSelected && (
        <div className="rte__context-bar">
          <span className="label">Image</span>
          {IMAGE_ALIGNMENTS.map(align => (
            <ToolButton
              key={align}
              title={`Align image ${align}`}
              active={state.imageAlign === align}
              onRun={() => chain().updateAttributes('image', {
                align: state.imageAlign === align ? null : align,
              }).run()}
            >
              <AlignIcon align={align} />
            </ToolButton>
          ))}
          <input
            type="text"
            className="rte__context-input"
            placeholder="Alt text"
            value={state.imageAlt}
            onChange={e => chain().updateAttributes('image', { alt: e.target.value }).run()}
          />
          <button
            type="button"
            className="rte__btn rte__btn--danger"
            title="Remove image"
            onMouseDown={e => { e.preventDefault(); chain().deleteSelection().run() }}
          >
            Remove
          </button>
        </div>
      )}

      {full && state.inTable && (
        <div className="rte__context-bar">
          <span className="label">Table</span>
          <ToolButton title="Insert row above" onRun={() => chain().addRowBefore().run()}>↑+ Row</ToolButton>
          <ToolButton title="Insert row below" onRun={() => chain().addRowAfter().run()}>↓+ Row</ToolButton>
          <ToolButton title="Delete row" onRun={() => chain().deleteRow().run()}>− Row</ToolButton>
          <div className="rte__divider" />
          <ToolButton title="Insert column left" onRun={() => chain().addColumnBefore().run()}>←+ Col</ToolButton>
          <ToolButton title="Insert column right" onRun={() => chain().addColumnAfter().run()}>→+ Col</ToolButton>
          <ToolButton title="Delete column" onRun={() => chain().deleteColumn().run()}>− Col</ToolButton>
          <div className="rte__divider" />
          <ToolButton title="Toggle header row" onRun={() => chain().toggleHeaderRow().run()}>Header</ToolButton>
          <ToolButton title="Merge or split cells" onRun={() => chain().mergeOrSplit().run()}>Merge</ToolButton>
          <button
            type="button"
            className="rte__btn rte__btn--danger"
            title="Delete table"
            onMouseDown={e => { e.preventDefault(); chain().deleteTable().run() }}
          >
            Delete table
          </button>
        </div>
      )}
    </>
  )
})

RichTextToolbar.displayName = 'RichTextToolbar'
