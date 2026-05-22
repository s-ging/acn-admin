import { useCallback, useRef } from 'react'
import { debounce } from 'lodash'
import { useCompanyStore } from '../store/company.store'
import type { CompanyFull } from '../types/company.types'

export function useDebouncedDraft() {
  const updateDraft = useCompanyStore(s => s.updateDraft)

  const debounced = useRef(
    debounce((patch: Partial<CompanyFull>) => {
      updateDraft(patch)
    }, 300)
  ).current

  const update = useCallback((patch: Partial<CompanyFull>) => {
    debounced(patch)
  }, [debounced])

  return update
}
