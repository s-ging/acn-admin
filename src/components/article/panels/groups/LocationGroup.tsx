import { memo } from 'react'
import { CollapsibleGroup } from '../../../ui/CollapsibleGroup'
import { useDebouncedArticleDraft } from '../../../../hooks/useDebouncedArticleDraft'
import { REGIONS } from '../../../../lib/press-releases/options'
import type { GroupProps } from './GroupProps'

/** Group 3 — where the release is from, and which regional wire it belongs on. */
export const LocationGroup = memo(({ draft, update }: GroupProps) => {
  const updateText = useDebouncedArticleDraft()

  return (
    <CollapsibleGroup title="Location" meta={draft.region ?? undefined}>

      <div className="metadata-panel__section">
        <span className="label">Region</span>
        <select
          className="metadata-status-select"
          value={draft.region ?? ''}
          onChange={e => update({ region: e.target.value || null })}
        >
          <option value="">— None —</option>
          {REGIONS.map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>
      </div>

      <div className="metadata-panel__section">
        <span className="label">Location</span>
        <input
          type="text"
          className="metadata-input"
          defaultValue={draft.location ?? ''}
          placeholder="e.g. Tokyo, Japan"
          onChange={e => updateText({ location: e.target.value || null })}
        />
        <span className="hint">
          Where the release was issued, used for routing. The line printed at the
          top of the release is the Dateline field on the canvas.
        </span>
      </div>

    </CollapsibleGroup>
  )
})

LocationGroup.displayName = 'LocationGroup'
