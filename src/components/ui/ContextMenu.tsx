import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  key: string
  label: string
  description?: string
  selected?: boolean
  onSelect: () => void
}

/**
 * A menu anchored at the cursor. Rendered through a portal so it can't be
 * clipped by a scrolling panel, and clamped so it never opens off-screen.
 * Closes on outside click, Escape, scroll or resize.
 */
export function ContextMenu({ x, y, header, items, onClose }: {
  x: number
  y: number
  header?: string
  items: ContextMenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  // Measure once mounted, then pull back inside the viewport if needed.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const margin = 8
    setPos({
      left: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(y, window.innerHeight - height - margin)),
    })
  }, [x, y])

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onClose)
    // capture phase, so scrolling any ancestor closes the menu rather than
    // leaving it stranded away from what it was anchored to
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={e => e.preventDefault()}
    >
      {header && <div className="context-menu__header">{header}</div>}
      {items.map(item => (
        <button
          key={item.key}
          type="button"
          role="menuitemradio"
          aria-checked={!!item.selected}
          className={`context-menu__item${item.selected ? ' context-menu__item--selected' : ''}`}
          onClick={() => { item.onSelect(); onClose() }}
        >
          <span className="context-menu__check">{item.selected ? '✓' : ''}</span>
          <span className="context-menu__body">
            <span className="context-menu__label">{item.label}</span>
            {item.description && (
              <span className="context-menu__description">{item.description}</span>
            )}
          </span>
        </button>
      ))}
    </div>,
    document.body
  )
}
