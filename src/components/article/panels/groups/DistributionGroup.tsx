import { memo } from 'react'
import { CollapsibleGroup } from '../../../ui/CollapsibleGroup'
import { useDebouncedArticleDraft } from '../../../../hooks/useDebouncedArticleDraft'
import { ARTICLE_TYPES, DISTRIBUTION_TARGETS, SOURCES } from '../../../../lib/press-releases/options'
import type { GroupProps } from './GroupProps'

/** Group 5 — what kind of release this is and where it goes. */
export const DistributionGroup = memo(({ draft, update }: GroupProps) => {
  const updateText = useDebouncedArticleDraft()

  return (
    <CollapsibleGroup title="Distribution" meta={draft.distribute_to ?? undefined}>

      <div className="metadata-panel__section">
        <span className="label">Article Type</span>
        <select
          className="metadata-status-select"
          value={draft.article_type ?? ''}
          onChange={e => update({ article_type: e.target.value || null })}
        >
          <option value="">— None —</option>
          {ARTICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="metadata-panel__section">
        <span className="label">Tracking ID</span>
        <input
          type="text"
          className="metadata-input"
          defaultValue={draft.tracking_id ?? ''}
          placeholder="e.g. ACN20260812-DVLT"
          onChange={e => updateText({ tracking_id: e.target.value || null })}
        />
      </div>

      <div className="metadata-panel__section">
        <span className="label">Distribute to</span>
        <select
          className="metadata-status-select"
          value={draft.distribute_to ?? ''}
          onChange={e => update({ distribute_to: e.target.value || null })}
        >
          <option value="">— None —</option>
          {DISTRIBUTION_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="metadata-panel__section">
        <span className="label">Source</span>
        <select
          className="metadata-status-select"
          value={draft.source ?? ''}
          onChange={e => update({ source: e.target.value || null })}
        >
          <option value="">— None —</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

    </CollapsibleGroup>
  )
})

DistributionGroup.displayName = 'DistributionGroup'
