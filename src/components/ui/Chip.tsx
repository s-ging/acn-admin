import { memo } from 'react'
import type { ReactNode } from 'react'

interface ChipProps {
  label: string
  /** Omit to render a read-only chip — derived values have nothing to remove. */
  onRemove?: () => void
  title?: string
}

export const Chip = memo(({ label, onRemove, title }: ChipProps) => (
  <span className="chip" title={title ?? label}>
    <span className="chip__label">{label}</span>
    {onRemove && (
      <button
        type="button"
        className="chip__remove"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        ×
      </button>
    )}
  </span>
))

Chip.displayName = 'Chip'

/** Wraps a row of chips and says so when there are none. */
export const ChipList = memo(({ empty, children }: { empty: string; children: ReactNode }) => {
  const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children)
  return (
    <div className="chip-list">
      {hasChildren ? children : <span className="chip-list__empty">{empty}</span>}
    </div>
  )
})

ChipList.displayName = 'ChipList'
