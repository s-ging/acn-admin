import { memo, useState } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { useUIStore } from '../../../store/ui.store'
import { Button } from '../../ui/Button'
import { ContextMenu } from '../../ui/ContextMenu'
import { SECTORS, SECTOR_TYPES, getSectorsByType } from '../../../lib/sectors'
import { applySectorRouting } from '../../../lib/sector-routing'
import {
  LANGUAGES,
  LANGUAGE_STATES,
  LANGUAGE_STATE_INFO,
  LANGUAGE_NAMES,
  getLanguageState,
  nextLanguageState,
  setLanguageState,
  describeLanguage,
} from '../../../lib/languages'
import type { LanguageState } from '../../../lib/languages'
import type { LanguageCode, CompanyStatus } from '../../../types/company.types'

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 6H7.5C6.67157 6 6 6.67157 6 7.5V15C6 15.8284 6.67157 16.5 7.5 16.5H15C15.8284 16.5 16.5 15.8284 16.5 15V7.5C16.5 6.67157 15.8284 6 15 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 12C2.175 12 1.5 11.325 1.5 10.5V3C1.5 2.175 2.175 1.5 3 1.5H10.5C11.325 1.5 12 2.175 12 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function LanguageDot({ state }: { state: LanguageState }) {
  const modifier = state === 'primary' ? 'active' : state === 'secondary' ? 'partial' : 'off'
  return <span className={`lang-dot lang-dot--${modifier}`} />
}

export const MetadataPanel = memo(() => {
  const draft = useCompanyStore(s => s.draft)
  const updateDraft = useCompanyStore(s => s.updateDraft)
  const { openModal } = useUIStore()

  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedUsername, setCopiedUsername] = useState(false)
  const [langMenu, setLangMenu] = useState<{ code: LanguageCode; x: number; y: number } | null>(null)

  if (!draft) return null

  const applyLanguageState = (code: LanguageCode, state: LanguageState) => {
    updateDraft(setLanguageState(draft, code, state))
  }

  const cycleLanguage = (code: LanguageCode) => {
    applyLanguageState(code, nextLanguageState(getLanguageState(draft, code)))
  }

  // Single-select: the draft still carries an array, but it holds at most one sector.
  const selectedSectorId = draft.sectors[0]?.sector_id ?? ''

  const handleSectorChange = (value: string) => {
    const previousSectorId = draft.sectors[0]?.sector_id ?? null

    if (!value) {
      updateDraft({
        sectors: [],
        wire_codes: applySectorRouting(draft.wire_codes, draft.id, previousSectorId, null),
      })
      return
    }
    const sector = SECTORS.find(s => s.id === Number(value))
    if (!sector) return
    updateDraft({
      sectors: [{
        id: draft.sectors[0]?.id ?? Date.now() + sector.id,
        company_id: draft.id,
        sector_id: sector.id,
        sector_type: sector.sector_type,
        sector_name: sector.sector_name,
      }],
      wire_codes: applySectorRouting(draft.wire_codes, draft.id, previousSectorId, sector.id),
    })
  }

  const handleCopyUsername = () => {
    if (draft.portal_username) {
      navigator.clipboard.writeText(draft.portal_username)
      setCopiedUsername(true)
      setTimeout(() => setCopiedUsername(false), 1500)
    }
  }

  const handleCopyPassword = () => {
    if (draft.portal_password) {
      navigator.clipboard.writeText(draft.portal_password)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  // LanguageCode currently covers exactly the five in LANGUAGES, so there is
  // nothing extra to reveal — the toggle is kept for when the list grows.
  const EXTRA_LANGUAGES: typeof LANGUAGES = []
  const visibleLanguages = expanded
    ? [...LANGUAGES, ...EXTRA_LANGUAGES]
    : LANGUAGES

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA').replace(/-/g, '/')

  return (
    <aside className="metadata-panel">

      <div className="label field">Metadata</div>

      {/* Sector */}
      <div className="metadata-panel__section">
        <span className="label">Sector</span>
        <select
          className="metadata-status-select"
          value={selectedSectorId}
          onChange={e => handleSectorChange(e.target.value)}
        >
          <option value="">— None —</option>
          {SECTOR_TYPES.map(type => (
            <optgroup key={type} label={type}>
              {getSectorsByType(type).map(s => (
                <option key={s.id} value={s.id}>{s.sector_name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="metadata-panel__divider" />

      {/* Status */}
      <div className="metadata-panel__section">
        <span className="label">Status</span>
        <select
          className="metadata-status-select"
          value={draft.status}
          onChange={e => updateDraft({ status: e.target.value as CompanyStatus })}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      <div className="metadata-panel__divider" />

      {/* Languages */}
      <div className="metadata-panel__section">
        <span className="label">Languages</span>
        <div className="lang-list">
          {visibleLanguages.map(({ code, label }) => {
            const state = getLanguageState(draft, code)
            return (
              <button
                key={code}
                className="lang-row"
                title={describeLanguage(code, state)}
                aria-label={`${LANGUAGE_NAMES[code]}: ${LANGUAGE_STATE_INFO[state].label}`}
                onClick={() => cycleLanguage(code)}
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
        <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'collapse...' : 'expand...'}
        </Button>
      </div>

      <div className="metadata-panel__divider" />

      {/* Annual Report */}
      <div className="metadata-panel__section">
        <span className="label">Annual Report</span>
        {draft.annual_report_url && (
          <a
            href={draft.annual_report_url}
            target="_blank"
            rel="noreferrer"
            className="annual-report-card"
          >
            <span className="annual-report-card__icon">📄</span>
            <div className="annual-report-card__info">
              <span>{draft.annual_report_name}</span>
              <span className="label faded thin">
                {draft.annual_report_date} · {draft.annual_report_size}
              </span>
            </div>
          </a>
        )}
        <Button variant="outline" size="sm" style={{ width: '100%' }} onClick={() => openModal('annual-report')}>
          ↑ Upload annual report
        </Button>
      </div>

      <div className="metadata-panel__divider" />

      {/* Portal Login */}
      <div className="metadata-panel__section">
        <span className="label">Portal Login</span>
        <div className="metadata-field">
          <span className="label">Username</span>
          <div className="input-box input-box--row">
            <span className="metadata-field__value">{draft.portal_username ?? ''}</span>
            <Button variant="ghost" size="sm" style={{ padding: 0 }} onClick={handleCopyUsername} title="Copy username">
              {copiedUsername ? '✓' : <CopyIcon />}
            </Button>
          </div>
        </div>
        <div className="metadata-field" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="label">Password</span>
            <span className="label faded clickable">Reset password</span>
          </div>
          <div className="input-box input-box--row">
            <span className="metadata-field__value metadata-field__value--masked">************</span>
            <Button variant="ghost" size="sm" style={{ padding: 0 }} onClick={handleCopyPassword} title="Copy password">
              {copied ? '✓' : <CopyIcon />}
            </Button>
          </div>
        </div>
      </div>

      <div className="metadata-panel__divider" />

      {/* Timestamps */}
      <div className="metadata-panel__section">
        <div className="metadata-kv">
          <span className="label faded">Created</span>
          <span className="label">{formatDate(draft.created_at)}</span>
        </div>
        <div className="metadata-kv">
          <span className="label faded">Last modified</span>
          <span className="label">{formatDate(draft.updated_at)}</span>
        </div>
        <div className="metadata-kv">
          <span className="label faded">Last modified by</span>
          <span className="label">{draft.updated_by_name ?? '—'}</span>
        </div>
      </div>

      <div className="metadata-panel__divider" />

      {/* JSON actions */}
      <div className="metadata-panel__section">
        <Button variant="outline" size="sm" style={{ width: '100%' }} onClick={() => openModal('json-export')}>
          Export as JSON
        </Button>
        <Button variant="outline" size="sm" style={{ width: '100%' }} onClick={() => openModal('json-import')}>
          Import JSON
        </Button>
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

    </aside>
  )
})

MetadataPanel.displayName = 'MetadataPanel'
