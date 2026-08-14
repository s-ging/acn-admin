import { useCallback, useRef } from 'react'
import { debounce } from 'lodash'
import { useArticleStore } from '../store/article.store'
import type { PressRelease } from '../types/press-release.types'

/**
 * Pattern A for the press release editor — the article-store twin of
 * useDebouncedDraft. Uncontrolled inputs write through here so typing isn't
 * throttled by the 300ms debounce.
 */
export function useDebouncedArticleDraft() {
  const updateDraft = useArticleStore(s => s.updateDraft)

  const debounced = useRef(
    debounce((patch: Partial<PressRelease>) => {
      updateDraft(patch)
    }, 300)
  ).current

  const update = useCallback((patch: Partial<PressRelease>) => {
    debounced(patch)
  }, [debounced])

  return update
}
