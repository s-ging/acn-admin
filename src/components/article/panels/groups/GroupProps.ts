import type { CompanyFull } from '../../../../types/company.types'
import type { PressRelease } from '../../../../types/press-release.types'

export interface GroupProps {
  draft: PressRelease
  /**
   * The single update path for the sidebar. Every patch runs through the
   * classification derivation on the way in, so Sector and Industry cannot
   * drift from the company selection no matter which control changed.
   *
   * Immediate, not debounced — free-text inputs use useDebouncedArticleDraft
   * directly instead.
   */
  update: (patch: Partial<PressRelease>) => void
  /** Every company in localStorage, sorted by name. */
  companies: CompanyFull[]
}
