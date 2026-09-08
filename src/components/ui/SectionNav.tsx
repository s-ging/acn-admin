// src/components/ui/SectionNav.tsx
// The three record types, as a breadcrumb-level switcher.
//
// Added with the events pages because there was nowhere to put a link to them:
// the list pages each had a "Home ›" crumb that went to /companies and nothing
// else, so a third section would have been reachable only by typing the URL.
//
// It replaces the crumb rather than sitting beside it — "Home" pointing at
// Companies was already standing in for a nav that didn't exist.

import { useNavigate } from 'react-router-dom'

export type Section = 'companies' | 'articles' | 'events'

const SECTIONS: { key: Section; label: string; path: string }[] = [
  { key: 'companies', label: 'Companies', path: '/companies' },
  { key: 'articles', label: 'Press Releases', path: '/article' },
  { key: 'events', label: 'Events', path: '/events' },
]

interface SectionNavProps {
  current: Section
  /** Appended after the section name, e.g. an event's title on its own page. */
  trail?: React.ReactNode
}

export function SectionNav({ current, trail }: SectionNavProps) {
  const navigate = useNavigate()

  return (
    <span className="section-nav">
      {SECTIONS.map(section => (
        <button
          key={section.key}
          type="button"
          className={`section-nav__item${section.key === current ? ' section-nav__item--on' : ''}`}
          // The current section is still clickable on a detail page, where it
          // means "back to the list" — which is the one place people reach for it.
          onClick={() => navigate(section.path)}
        >
          {section.label}
        </button>
      ))}
      {trail && (
        <>
          <span className="section-nav__sep">›</span>
          <span className="section-nav__trail">{trail}</span>
        </>
      )}
    </span>
  )
}
