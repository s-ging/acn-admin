import { memo, useState } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { useUIStore } from '../../../store/ui.store'
import type { LanguageCode, CompanyStatus } from '../../../types/company.types'

const ALL_LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'EN', label: 'EN' },
  { code: 'ZH-HANS', label: 'ZH-HANS' },
  { code: 'ZH-HANT', label: 'ZH-HANT' },
  { code: 'JA', label: 'JA' },
  { code: 'KO', label: 'KO' },
]

const EXTRA_LANGUAGES: { code: LanguageCode; label: string }[] = []

function LanguageDot({ active, partial }: { active: boolean; partial?: boolean }) {
  if (active) return <span className="lang-dot lang-dot--active" />
  if (partial) return <span className="lang-dot lang-dot--partial" />
  return <span className="lang-dot lang-dot--off" />
}

export const MetadataPanel = memo(() => {
  const draft = useCompanyStore(s => s.draft)
  const updateDraft = useCompanyStore(s => s.updateDraft)
  const { openModal } = useUIStore()

  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [partialLanguages, setPartialLanguages] = useState<Set<LanguageCode>>(new Set())

  if (!draft) return null

  const cycleLanguage = (code: LanguageCode) => {
    const isActive = draft.languages.includes(code)
    const isPartial = partialLanguages.has(code)

    if (!isActive && !isPartial) {
      // blank → black
      setPartialLanguages(prev => new Set([...prev, code]))
    } else if (isPartial) {
      // black → green
      setPartialLanguages(prev => { const n = new Set(prev); n.delete(code); return n })
      updateDraft({ languages: [...draft.languages, code] })
    } else {
      // green → blank
      updateDraft({ languages: draft.languages.filter(l => l !== code) })
    }
  }

  const handleCopyPassword = () => {
    if (draft.portal_password) {
      navigator.clipboard.writeText(draft.portal_password)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const visibleLanguages = expanded
    ? [...ALL_LANGUAGES, ...EXTRA_LANGUAGES]
    : ALL_LANGUAGES

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA').replace(/-/g, '/')

  return (
    <aside className="metadata-panel">

      <div className="metadata-panel__title">Metadata</div>

      {/* Status */}
      <div className="metadata-panel__section">
        <span className="metadata-panel__label">Status</span>
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
        <span className="metadata-panel__label">Languages</span>
        <div className="lang-list">
          {visibleLanguages.map(({ code, label }) => (
            <button
              key={code}
              className="lang-row"
              onClick={() => cycleLanguage(code)}
            >
              <span className="lang-row__label">{label}</span>
              <LanguageDot active={draft.languages.includes(code)} partial={partialLanguages.has(code)} />
            </button>
          ))}
        </div>
        <button className="metadata-expand-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'collapse...' : 'expand...'}
        </button>
      </div>

      <div className="metadata-panel__divider" />

      {/* Annual Report */}
      <div className="metadata-panel__section">
        <span className="metadata-panel__label">Annual Report</span>
        {draft.annual_report_url && (
          <a
            href={draft.annual_report_url}
            target="_blank"
            rel="noreferrer"
            className="annual-report-card"
          >
            <span className="annual-report-card__icon">📄</span>
            <div className="annual-report-card__info">
              <span className="annual-report-card__name">{draft.annual_report_name}</span>
              <span className="annual-report-card__meta">
                {draft.annual_report_date} · {draft.annual_report_size}
              </span>
            </div>
          </a>
        )}
        <label className="annual-report-upload">
          <span className="annual-report-upload__icon">↑</span>
          <span>Upload annual report</span>
          <input type="file" accept=".pdf" hidden />
        </label>
      </div>

      <div className="metadata-panel__divider" />

      {/* Portal Login */}
      <div className="metadata-panel__section">
        <span className="metadata-panel__label metadata-panel__label--bold">Portal Login</span>
        <div className="metadata-field">
          <span className="metadata-field__label">Username</span>
          <div className="metadata-field__input-box">
            <span className="metadata-field__value">{draft.portal_username ?? ''}</span>
          </div>
        </div>
        <div className="metadata-field" style={{ marginTop: 12 }}>
          <span className="metadata-field__label">Password</span>
          <div className="metadata-field__input-box metadata-field__input-box--password">
            <span className="metadata-field__value metadata-field__value--masked">************</span>
            <button className="metadata-copy-btn" onClick={handleCopyPassword} title="Copy password">
              {copied ? '✓' : '⧉'}
            </button>
          </div>
        </div>
        <button className="metadata-forgot-btn">Forgot password?</button>
      </div>

      <div className="metadata-panel__divider" />

      {/* Timestamps */}
      <div className="metadata-panel__section">
        <div className="metadata-kv">
          <span className="metadata-kv__key">Created</span>
          <span className="metadata-kv__value">{formatDate(draft.created_at)}</span>
        </div>
        <div className="metadata-kv">
          <span className="metadata-kv__key">Last modified</span>
          <span className="metadata-kv__value">{formatDate(draft.updated_at)}</span>
        </div>
        <div className="metadata-kv">
          <span className="metadata-kv__key">Last modified by</span>
          <span className="metadata-kv__value metadata-kv__value--bold">{draft.updated_by_name ?? '—'}</span>
        </div>
      </div>

      <div className="metadata-panel__divider" />

      {/* JSON actions */}
      <div className="metadata-panel__section">
        <button className="metadata-action-btn" onClick={() => openModal('json-export')}>
          Export as JSON
        </button>
        <button className="metadata-action-btn" onClick={() => openModal('json-import')}>
          Import JSON
        </button>
      </div>

    </aside>
  )
})

MetadataPanel.displayName = 'MetadataPanel'
