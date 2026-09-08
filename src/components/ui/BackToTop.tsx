// src/components/ui/BackToTop.tsx
// Back to the top of a long list.
//
// It watches a specific scroll container rather than the window, because the
// list pages don't scroll the document — `.companies-page` is a full-height
// flex column and `.companies-table-wrap` is the only thing that scrolls.
//
// Hidden until there is something to come back from: appearing at scroll 0
// would just be a button covering a row.

import { useEffect, useState } from 'react'

/** How far down before the button is worth showing. About one screen. */
const SHOW_AFTER = 600

interface BackToTopProps {
  /** The scrolling element. Nothing renders until it exists. */
  targetRef: React.RefObject<HTMLElement | null>
  /** Re-checks position when this changes — a new page of rows resets scroll. */
  resetKey?: unknown
}

export function BackToTop({ targetRef, resetKey }: BackToTopProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    const update = () => setVisible(target.scrollTop > SHOW_AFTER)
    update()

    target.addEventListener('scroll', update, { passive: true })
    return () => target.removeEventListener('scroll', update)
  }, [targetRef, resetKey])

  if (!visible) return null

  return (
    <button
      type="button"
      className="back-to-top"
      onClick={() =>
        targetRef.current?.scrollTo({
          top: 0,
          // Honour a reduced-motion preference: a long smooth scroll is exactly
          // the kind of movement that setting exists to suppress.
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
        })
      }
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Back to top
    </button>
  )
}
