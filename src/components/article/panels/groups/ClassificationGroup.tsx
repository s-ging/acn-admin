import { memo, useState } from 'react'
import { CollapsibleGroup } from '../../../ui/CollapsibleGroup'
import { Chip, ChipList } from '../../../ui/Chip'
import { ContextMenu } from '../../../ui/ContextMenu'
import { LanguageDot } from '../../../ui/LanguageDot'
import { SECTORS, SECTOR_TYPES } from '../../../../lib/sectors'
import { TOPICS } from '../../../../lib/press-releases/options'
import {
  LANGUAGES,
  LANGUAGE_STATES,
  LANGUAGE_STATE_INFO,
  LANGUAGE_NAMES,
  getLanguageState,
  nextLanguageState,
  setLanguageState,
  describeLanguage,
} from '../../../../lib/languages'
import type { LanguageState } from '../../../../lib/languages'
import type { LanguageCode } from '../../../../types/company.types'
import type { GroupProps } from './GroupProps'

const INDUSTRY_OPTIONS = [...new Set(SECTORS.map(s => s.sector_name))].sort()

/**
 * Group 2 — the consequence of group 1, and quieter for it.
 *
 * Sector and Industry are read-only while the release is on the derivation.
 * Overriding unlocks them and stops recomputation; going back to derived
 * recomputes immediately, so the two states can't disagree silently.
 */
export const ClassificationGroup = memo(({ draft, update, companies }: GroupProps) => {
  const [langMenu, setLangMenu] = useState<{ code: LanguageCode; x: number; y: number } | null>(null)

  const overridden = draft.classification_overridden
  const primaryIssuer = companies.find(c => c.id === draft.primary_issuer_id) ?? null

  const applyLanguageState = (code: LanguageCode, state: LanguageState) => {
    update(setLanguageState(draft, code, state))
  }

  const derivedFrom = primaryIssuer
    ? `Derived from ${primaryIssuer.name_en}, the primary issuer.`
    : 'Add a company in Publication to derive the sector.'

  const addIndustry = (name: string) => {
    if (!name || draft.industries.includes(name)) return
    update({ industries: [...draft.industries, name] })
  }

  const removeIndustry = (name: string) => {
    update({ industries: draft.industries.filter(i => i !== name) })
  }

  return (
    <CollapsibleGroup title="Classification" meta={overridden ? 'overridden' : 'derived'}>

      {/* Sector — from the primary company only */}
      <div className={`metadata-panel__section${overridden ? '' : ' metadata-field--derived'}`}>
        <div className="metadata-kv">
          <span className="label">Sector</span>
          <span
            className="label faded clickable"
            role="button"
            tabIndex={0}
            title={
              overridden
                ? 'Go back to the sector and industries implied by the selected companies'
                : 'Edit the sector and industries by hand — they will stop following the companies'
            }
            onClick={() => update({ classification_overridden: !overridden })}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') update({ classification_overridden: !overridden })
            }}
          >
            {overridden ? 'Use derived' : 'Override'}
          </span>
        </div>

        {overridden ? (
          <select
            className="metadata-status-select"
            value={draft.sector_type ?? ''}
            onChange={e => update({ sector_type: e.target.value || null })}
          >
            <option value="">— None —</option>
            {SECTOR_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        ) : (
          <>
            <div className="input-box">{draft.sector_type ?? '—'}</div>
            <span className="hint">{derivedFrom}</span>
          </>
        )}
      </div>

      {/* Industry — from every selected company */}
      <div className={`metadata-panel__section${overridden ? '' : ' metadata-field--derived'}`}>
        <span className="label">Industry</span>

        <ChipList empty={overridden ? 'None yet.' : 'No sectors on the companies for this release.'}>
          {draft.industries.map(name => (
            <Chip
              key={name}
              label={name}
              onRemove={overridden ? () => removeIndustry(name) : undefined}
            />
          ))}
        </ChipList>

        {overridden ? (
          <select
            className="metadata-status-select"
            value=""
            onChange={e => { addIndustry(e.target.value); e.currentTarget.value = '' }}
          >
            <option value="">+ Add industry…</option>
            {INDUSTRY_OPTIONS.filter(name => !draft.industries.includes(name)).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        ) : (
          <span className="hint">One per company on the release, deduped.</span>
        )}
      </div>

      {/* Topic — an editorial tag, not derived */}
      <div className="metadata-panel__section">
        <span className="label">Topic</span>
        <select
          className="metadata-status-select"
          value={draft.topic ?? ''}
          onChange={e => update({ topic: e.target.value || null })}
        >
          <option value="">— None —</option>
          {TOPICS.map(topic => (
            <option key={topic} value={topic}>{topic}</option>
          ))}
        </select>
      </div>

      {/* Languages — same three-state model as a company's */}
      <div className="metadata-panel__section">
        <span className="label">Languages</span>
        <div className="lang-list">
          {LANGUAGES.map(({ code, label }) => {
            const state = getLanguageState(draft, code)
            return (
              <button
                key={code}
                className="lang-row"
                title={describeLanguage(code, state)}
                aria-label={`${LANGUAGE_NAMES[code]}: ${LANGUAGE_STATE_INFO[state].label}`}
                onClick={() => applyLanguageState(code, nextLanguageState(state))}
                onContextMenu={e => {
                  e.preventDefault()
                  setLangMenu({ code, x: e.clientX, y: e.clientY })
                }}
              >
                <span className="label">{label}</span>
                <LanguageDot state={state} />
              </button>
            )
          })}
        </div>
      </div>

      {langMenu && (
        <ContextMenu
          x={langMenu.x}
          y={langMenu.y}
          header={LANGUAGE_NAMES[langMenu.code]}
          onClose={() => setLangMenu(null)}
          items={LANGUAGE_STATES.map(({ state, label, description }) => ({
            key: state,
            label,
            description,
            selected: getLanguageState(draft, langMenu.code) === state,
            onSelect: () => applyLanguageState(langMenu.code, state),
          }))}
        />
      )}

    </CollapsibleGroup>
  )
})

ClassificationGroup.displayName = 'ClassificationGroup'
