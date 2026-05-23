import { memo, useState } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { useUIStore } from '../../../store/ui.store'
import { Button } from '../../ui/Button'
import type { LanguageCode, CompanyStatus } from '../../../types/company.types'

const ALL_LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'EN', label: 'EN' },
  { code: 'ZH-HANS', label: 'ZH-HANS' },
  { code: 'ZH-HANT', label: 'ZH-HANT' },
  { code: 'JA', label: 'JA' },
  { code: 'KO', label: 'KO' },
]

const EXTRA_LANGUAGES: { code: LanguageCode; label: string }[] = []

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 6H7.5C6.67157 6 6 6.67157 6 7.5V15C6 15.8284 6.67157 16.5 7.5 16.5H15C15.8284 16.5 16.5 15.8284 16.5 15V7.5C16.5 6.67157 15.8284 6 15 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 12C2.175 12 1.5 11.325 1.5 10.5V3C1.5 2.175 2.175 1.5 3 1.5H10.5C11.325 1.5 12 2.175 12 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

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
  const [copiedUsername, setCopiedUsername] = useState(false)
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

  const visibleLanguages = expanded
    ? [...ALL_LANGUAGES, ...EXTRA_LANGUAGES]
    : ALL_LANGUAGES

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA').replace(/-/g, '/')

  return (
    <aside className="metadata-panel">

      <div className="label field">Metadata</div>

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
          {visibleLanguages.map(({ code, label }) => (
            <button
              key={code}
              className="lang-row"
              onClick={() => cycleLanguage(code)}
            >
              <span className="label">{label}</span>
              <LanguageDot active={draft.languages.includes(code)} partial={partialLanguages.has(code)} />
            </button>
          ))}
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

    </aside>
  )
})

MetadataPanel.displayName = 'MetadataPanel'
