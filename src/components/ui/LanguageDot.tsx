import { memo } from 'react'
import type { LanguageState } from '../../lib/languages'

/** The tri-state language dot. See lib/languages.ts for what each state means. */
export const LanguageDot = memo(({ state }: { state: LanguageState }) => {
  const modifier = state === 'primary' ? 'active' : state === 'secondary' ? 'partial' : 'off'
  return <span className={`lang-dot lang-dot--${modifier}`} />
})

LanguageDot.displayName = 'LanguageDot'
