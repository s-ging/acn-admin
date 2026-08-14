import { memo, useCallback, useState } from 'react'
import { useArticleStore } from '../../../store/article.store'
import { loadCompanies } from '../../../lib/companies/storage'
import { applyDerivedClassification } from '../../../lib/press-releases/derive'
import { applyAutoDateline } from '../../../lib/press-releases/dateline'
import { PublicationGroup } from './groups/PublicationGroup'
import { ClassificationGroup } from './groups/ClassificationGroup'
import { LocationGroup } from './groups/LocationGroup'
import { RelationsGroup } from './groups/RelationsGroup'
import { DistributionGroup } from './groups/DistributionGroup'
import { WorkflowGroup } from './groups/WorkflowGroup'
import type { CompanyFull } from '../../../types/company.types'
import type { PressRelease } from '../../../types/press-release.types'

/**
 * The right half of the editor: six collapsible groups, in the order the work
 * happens — Publication first, because everything in Classification is computed
 * from the companies chosen there.
 *
 * Every group patches the draft through the `update` built here, so the
 * derivation runs on exactly one path and Sector/Industry can never drift from
 * the company selection.
 */
export const ArticleMetadataPanel = memo(() => {
  const draft = useArticleStore(s => s.draft)
  const updateDraft = useArticleStore(s => s.updateDraft)

  // Read once per mount — the picker lists don't change while the editor is open.
  const [companies] = useState(() =>
    loadCompanies().sort((a, b) => a.name_en.localeCompare(b.name_en))
  )

  const update = useCallback((patch: Partial<PressRelease>) => {
    const current = useArticleStore.getState().draft
    if (!current) return

    const next = { ...current, ...patch }
    const byId = (id: number | null) => companies.find(c => c.id === id) ?? null

    // Two consequences hang off this one path: the classification follows the
    // companies, and the dateline follows Location and Date.
    const classification = applyDerivedClassification(next, {
      companies: next.company_ids.map(byId).filter(Boolean) as CompanyFull[],
      primaryIssuer: byId(next.primary_issuer_id),
    })
    const dateline = applyAutoDateline({ ...next, ...classification })

    updateDraft({ ...patch, ...classification, ...dateline })
  }, [companies, updateDraft])

  if (!draft) return null

  const groupProps = { draft, update, companies }

  return (
    <aside className="article-panel">

      <div className="article-panel__title">
        <span className="label field">Metadata</span>
      </div>

      <PublicationGroup {...groupProps} />
      <ClassificationGroup {...groupProps} />
      <LocationGroup {...groupProps} />
      <RelationsGroup {...groupProps} />
      <DistributionGroup {...groupProps} />
      <WorkflowGroup {...groupProps} />

    </aside>
  )
})

ArticleMetadataPanel.displayName = 'ArticleMetadataPanel'
