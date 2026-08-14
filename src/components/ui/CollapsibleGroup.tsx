import { memo, useState } from 'react'
import type { ReactNode } from 'react'

interface CollapsibleGroupProps {
  title: string
  /** Right-aligned summary shown in the header, e.g. a count or derived value. */
  meta?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span className={`meta-group__chevron${open ? ' meta-group__chevron--open' : ''}`}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

/**
 * A titled section of a metadata panel that opens and closes. The body
 * unmounts when closed, so uncontrolled inputs inside it re-read from the
 * draft on the way back in.
 */
export const CollapsibleGroup = memo(({ title, meta, defaultOpen = true, children }: CollapsibleGroupProps) => {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="meta-group">
      <button
        type="button"
        className="meta-group__header"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="label">{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {meta && <span className="hint">{meta}</span>}
          <Chevron open={open} />
        </span>
      </button>
      {open && <div className="meta-group__body">{children}</div>}
    </section>
  )
})

CollapsibleGroup.displayName = 'CollapsibleGroup'
