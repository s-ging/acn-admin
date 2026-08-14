import { memo } from 'react'
import { CollapsibleGroup } from '../../../ui/CollapsibleGroup'
import { useDebouncedArticleDraft } from '../../../../hooks/useDebouncedArticleDraft'
import type { GroupProps } from './GroupProps'

/**
 * Group 6 — who handled the release. Status used to live here; it moved up to
 * Publication, because it is something you set rather than something you record.
 */
export const WorkflowGroup = memo(({ draft }: GroupProps) => {
  const updateText = useDebouncedArticleDraft()

  return (
    <CollapsibleGroup title="Workflow" defaultOpen={false}>

      <div className="metadata-panel__section">
        <span className="label">Report By</span>
        <input
          type="text"
          className="metadata-input"
          defaultValue={draft.report_by ?? ''}
          placeholder="Who wrote it up"
          onChange={e => updateText({ report_by: e.target.value || null })}
        />
      </div>

      <div className="metadata-panel__section">
        <span className="label">Send By</span>
        <input
          type="text"
          className="metadata-input"
          defaultValue={draft.send_by ?? ''}
          placeholder="Who puts it on the wire"
          onChange={e => updateText({ send_by: e.target.value || null })}
        />
      </div>

    </CollapsibleGroup>
  )
})

WorkflowGroup.displayName = 'WorkflowGroup'
