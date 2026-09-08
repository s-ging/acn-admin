// src/components/ui/AlphabetIndex.tsx
// A–Z, as a filter down to records whose name starts with one letter.
//
// A filter rather than a scroll-to. On a paginated list a jump would have to
// work out which page the letter falls on and send you there, and the answer
// changes with every sort and filter; narrowing the set instead composes with
// the other controls and always lands you on page 1 of the letter.
//
// Letters with nothing behind them are disabled rather than hidden, so the row
// keeps a stable width and the alphabet stays where the eye left it. `#` covers
// everything that doesn't start with a Latin letter — which here is mostly CJK
// headlines and names beginning with a digit.

import { LETTERS } from '../../lib/list/alphabet'

interface AlphabetIndexProps {
  /** Which buckets have at least one record, from `initialOf`. */
  available: Set<string>
  /** The chosen letter, or null for all. */
  value: string | null
  onChange: (letter: string | null) => void
}

export function AlphabetIndex({ available, value, onChange }: AlphabetIndexProps) {
  return (
    <div className="alpha-index" role="group" aria-label="Filter by first letter">
      <button
        type="button"
        className={`alpha-index__item${value === null ? ' alpha-index__item--on' : ''}`}
        onClick={() => onChange(null)}
      >
        All
      </button>

      {[...LETTERS, '#'].map(letter => {
        const enabled = available.has(letter)
        return (
          <button
            key={letter}
            type="button"
            className={`alpha-index__item${value === letter ? ' alpha-index__item--on' : ''}`}
            disabled={!enabled}
            title={letter === '#' ? 'Names not starting with A–Z' : undefined}
            // Clicking the active letter again clears it, so the row doubles as
            // its own reset without needing a trip to "All".
            onClick={() => onChange(value === letter ? null : letter)}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}
