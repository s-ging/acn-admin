import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCompanyStore } from '../../store/company.store'
import { CommitDialog } from '../company/modals/CommitDialog'
import { JSONExportDialog } from '../company/modals/JSONExportDialog'
import { JSONImportDialog } from '../company/modals/JSONImportDialog'
import { AnnualReportDialog } from '../company/modals/AnnualReportDialog'
import { computeDiff } from '../../lib/companies/diff'
import { MOCK_COMPANY } from '../../lib/mock'
import { seedLocalStorage, clearSeed, ALL_SEED_COMPANIES } from '../../dev/seed'
import type { CompanyFull } from '../../types/company.types'

const MOCK_DRAFT: CompanyFull = {
  ...MOCK_COMPANY,
  name_ja: '三菱重工業 株式会社',
  employees: '80,000+',
  company_email: 'press@mhi.com',
  languages: ['EN', 'JA', 'ZH-HANS', 'KO'],
  contacts: MOCK_COMPANY.contacts.filter(c => c.id !== 3),
  sectors: [
    ...MOCK_COMPANY.sectors,
    { id: 99, company_id: 1, sector_id: 99, sector_type: 'Technology', sector_name: 'Artificial Intelligence' },
  ],
  wire_services: [
    ...MOCK_COMPANY.wire_services,
    { id: 99, company_id: 1, name: 'Tech Wire Asia', email: 'news@techwireasia.com', country: 'Singapore' },
  ],
}

const noop = () => {}

export default function ModalPreview() {
  const setOriginal = useCompanyStore(s => s.setOriginal)

  useEffect(() => {
    setOriginal(MOCK_COMPANY)
  }, [setOriginal])

  const changes = useMemo(() => computeDiff(MOCK_COMPANY, MOCK_DRAFT), [])

  return (
    <div className="modal-preview">
      <div className="seed-controls">
        <span className="seed-controls__label">
          Dev seed — {ALL_SEED_COMPANIES.length} companies in localStorage
        </span>
        <button
          className="seed-controls__btn"
          onClick={() => { seedLocalStorage(); window.location.reload() }}
        >
          ↺ Re-seed all
        </button>
        <button
          className="seed-controls__btn seed-controls__btn--danger"
          onClick={() => { clearSeed(); window.location.reload() }}
        >
          ✕ Clear all
        </button>
      </div>
      <div className="modal-preview__header">
        <span className="modal-preview__tag">DEV</span>
        Modal Preview
        <Link to="/companies" className="modal-preview__hint">← back to editor</Link>
      </div>

      <div className="modal-preview__grid">
        <div className="modal-preview__col">
          <div className="modal-preview__col-label">commit mode</div>
          <CommitDialog
            mode="commit"
            draft={MOCK_DRAFT}
            changes={changes}
            ready={true}
            onClose={noop}
            onCommit={noop}
            onDiscard={noop}
          />
        </div>
        <div className="modal-preview__col">
          <div className="modal-preview__col-label">discard mode</div>
          <CommitDialog
            mode="discard"
            draft={MOCK_DRAFT}
            changes={changes}
            ready={true}
            onClose={noop}
            onCommit={noop}
            onDiscard={noop}
          />
        </div>
        <div className="modal-preview__col">
          <div className="modal-preview__col-label">empty state — commit</div>
          <CommitDialog
            mode="commit"
            draft={MOCK_DRAFT}
            changes={[]}
            ready={true}
            onClose={noop}
            onCommit={noop}
            onDiscard={noop}
          />
        </div>
        <div className="modal-preview__col">
          <div className="modal-preview__col-label">empty state — discard</div>
          <CommitDialog
            mode="discard"
            draft={MOCK_DRAFT}
            changes={[]}
            ready={true}
            onClose={noop}
            onCommit={noop}
            onDiscard={noop}
          />
        </div>
        <div className="modal-preview__col">
          <div className="modal-preview__col-label">reverted state</div>
          <CommitDialog
            mode="discard"
            draft={MOCK_DRAFT}
            changes={changes}
            ready={true}
            reverted={true}
            onClose={noop}
            onCommit={noop}
            onDiscard={noop}
          />
        </div>
        <div className="modal-preview__col">
          <div className="modal-preview__col-label">json export</div>
          <JSONExportDialog
            draft={MOCK_DRAFT}
            onClose={noop}
          />
        </div>
        <div className="modal-preview__col">
          <div className="modal-preview__col-label">json import</div>
          <JSONImportDialog
            onClose={noop}
            onLoad={noop}
          />
        </div>
        <div className="modal-preview__col">
          <div className="modal-preview__col-label">annual report</div>
          <AnnualReportDialog
            onClose={noop}
            onApply={noop}
          />
        </div>
      </div>
    </div>
  )
}
