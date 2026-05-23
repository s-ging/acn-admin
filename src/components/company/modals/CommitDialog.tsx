import { memo, useRef, useState, useCallback } from 'react'
import { PencilIcon } from '../../ui/PencilIcon'
import { CheckCircleIcon } from '../../ui/CheckCircleIcon'
import { Button } from '../../ui/Button'
import type { Change, ChangeSection, FieldChange, RecordChange, CompanyFull } from '../../../types/company.types'

export type CommitMode = 'commit' | 'discard'

export interface CommitDialogProps {
  mode?: CommitMode
  draft: CompanyFull | null
  changes: Change[]
  ready: boolean
  reverted?: boolean
  onClose: () => void
  onCommit: () => void
  onDiscard: () => void
}

const SECTION_LABELS: Record<ChangeSection, string> = {
  'basic-info': 'Basic Info',
  'contacts': 'Contacts',
  'distribution': 'Distribution',
  'identifiers': 'Identifiers',
  'company-details': 'Company Details',
}

const SECTION_ORDER: ChangeSection[] = [
  'basic-info', 'contacts', 'distribution', 'identifiers', 'company-details',
]

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  return String(val)
}

const EditRow = memo(({ change }: { change: FieldChange }) => (
  <div className="commit-row commit-row--edit">
    <div className="commit-row__icon"><PencilIcon /></div>
    <div className="commit-row__body">
      <div className="label field">{change.label}</div>
      <div className="commit-row__diff">
        <span className="commit-row__old">{formatValue(change.old_value)}</span>
        <span className="commit-row__arrow">→</span>
        <span className="commit-row__new">{formatValue(change.new_value)}</span>
      </div>
    </div>
  </div>
))
EditRow.displayName = 'EditRow'

const RecordRow = memo(({ change }: { change: RecordChange }) => {
  const isAdd = change.type === 'add'
  return (
    <div className={`commit-row commit-row--${isAdd ? 'add' : 'remove'}`}>
      <div className={`commit-row__glyph commit-row__glyph--${isAdd ? 'add' : 'remove'}`}>
        {isAdd ? '+' : '−'}
      </div>
      <div className="commit-row__body">
        <div className="label field">{change.entity} {isAdd ? 'added' : 'removed'}</div>
        <div className="hint">
          {change.label}{change.detail ? ` · ${change.detail}` : ''}
        </div>
      </div>
    </div>
  )
})
RecordRow.displayName = 'RecordRow'

export const CommitDialog = memo(({
  mode = 'commit',
  draft,
  changes,
  ready,
  reverted = false,
  onClose,
  onCommit,
  onDiscard,
}: CommitDialogProps) => {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [holdProgress, setHoldProgress] = useState(0)

  const startHold = useCallback(() => {
    setHoldProgress(0)
    requestAnimationFrame(() => setHoldProgress(100))
    holdTimer.current = setTimeout(() => {
      onDiscard()
    }, 2000)
  }, [onDiscard])

  const cancelHold = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    setHoldProgress(0)
  }, [])

  const grouped = SECTION_ORDER.reduce<Record<ChangeSection, Change[]>>(
    (acc, section) => { acc[section] = changes.filter(c => c.section === section); return acc },
    {} as Record<ChangeSection, Change[]>
  )

  const additions = changes.filter(c => c.type === 'add').length
  const removals  = changes.filter(c => c.type === 'remove').length
  const edits     = changes.filter(c => c.type === 'edit').length

  const summaryParts: string[] = []
  if (additions > 0) summaryParts.push(`${additions} ${additions === 1 ? 'addition' : 'additions'}`)
  if (removals  > 0) summaryParts.push(`${removals} ${removals === 1 ? 'removal' : 'removals'}`)
  if (edits     > 0) summaryParts.push(`${edits} ${edits === 1 ? 'edit' : 'edits'}`)

  const companyName = draft?.name_en ?? ''
  const isEmpty = ready && changes.length === 0

  const title = mode === 'discard'
    ? `Discard ${companyName} changes?`
    : `Commit ${companyName} changes`

  const subtitle = mode === 'discard'
    ? "Are you sure? Changes won't be made."
    : 'Review what\'s changing before committing. This cannot be undone.'

  const HoldButton = (
    <Button
      variant="danger"
      className="commit-modal__cancel-btn"
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
    >
      <div
        className={`commit-modal__cancel-progress${holdProgress === 100 ? ' commit-modal__cancel-progress--active' : ''}`}
        style={holdProgress === 0 ? { transition: 'none' } : undefined}
      />
      <span className="commit-modal__cancel-label">
        {mode === 'discard' ? 'Discard changes' : 'Hold to cancel'}
      </span>
    </Button>
  )

  return (
    <div className="commit-dialog" role="dialog" aria-modal="true">
      <div className="commit-header">
        <div className="commit-header__text">
          <div className="label field">{title}</div>
          <div className="hint">{subtitle}</div>
        </div>
        <button className="commit-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {reverted ? (
        <div className="commit-empty">
          <div className="commit-reverted__icon"><CheckCircleIcon /></div>
          <div className="flex flex-col gap-1">
            <div className="label field">This window will close automatically.</div>
            <div className="hint">No changes are recorded, your data is safe.</div>
          </div>
        </div>
      ) : !ready ? (
        <div className="commit-loading">Checking changes…</div>
      ) : isEmpty ? (
        <div className="commit-empty">
          <div className="flex flex-col gap-1 mb-4">
            <div className="label field">
              {mode === 'discard' ? 'No unsaved changes.' : 'No changes to commit.'}
            </div>
            <div className="hint">
              {mode === 'discard' ? 'Your draft matches the saved version.' : 'Everything is up to date.'}
            </div>
          </div>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      ) : (
        <>
          <div className="commit-body">
            {SECTION_ORDER.map(section => {
              const group = grouped[section]
              if (group.length === 0) return null
              return (
                <div key={section} className="commit-section">
                  <div className="commit-section__header">
                    <span className="label">{SECTION_LABELS[section]}</span>
                    <span className="commit-section__badge">{group.length}</span>
                  </div>
                  <div className="commit-section__rows">
                    {group.map((change, i) =>
                      change.type === 'edit'
                        ? <EditRow key={i} change={change as FieldChange} />
                        : <RecordRow key={i} change={change as RecordChange} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="commit-footer">
            <div className="hint">{summaryParts.join(' · ')}</div>
            <div className="commit-footer__actions">
              {mode === 'discard' ? (
                <>
                  <Button variant="outline" onClick={onClose}>Keep editing</Button>
                  {HoldButton}
                </>
              ) : (
                <>
                  {HoldButton}
                  <Button variant="warning" onClick={onClose}>Edit changes</Button>
                  <Button variant="primary" onClick={onCommit}>Commit changes</Button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
})

CommitDialog.displayName = 'CommitDialog'
