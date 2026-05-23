import { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
// import { useBlocker } from 'react-router-dom'
import { useCompanyStore } from '../../store/company.store'
import { useUIStore } from '../../store/ui.store'
import { useToastStore } from '../../store/toast.store'
import { computeDiff } from '../../lib/companies/diff'
import { TabBar } from '../ui/TabBar'
import { Topbar } from '../ui/Topbar'
import { MetadataPanel } from './panels/MetadataPanel'
import { Button } from '../ui/Button'
import { CommitModal } from './modals/CommitModal'
import { JSONExportModal } from './modals/JSONExportModal'
import { JSONImportModal } from './modals/JSONImportModal'
import { AnnualReportModal } from './modals/AnnualReportModal'
import { UnsavedChangesModal } from './modals/UnsavedChangesModal'
import type { Tab } from '../../types/company.types'
import BasicInfoTab      from './tabs/BasicInfoTab'
import ContactsTab       from './tabs/ContactsTab'
import DistributionTab   from './tabs/DistributionTab'
import IdentifiersTab    from './tabs/IdentifiersTab'
import CompanyDetailsTab from './tabs/CompanyDetailsTab'

const TABS: { key: Tab; label: string }[] = [
  { key: 'basic-info',      label: 'Basic Info' },
  { key: 'contacts',        label: 'Contacts' },
  { key: 'distribution',    label: 'Distribution' },
  { key: 'identifiers',     label: 'Identifiers' },
  { key: 'company-details', label: 'Company Details' },
]

const TAB_COMPONENTS = {
  'basic-info':      BasicInfoTab,
  'contacts':        ContactsTab,
  'distribution':    DistributionTab,
  'identifiers':     IdentifiersTab,
  'company-details': CompanyDetailsTab,
}

export default function CompanyEditor() {
  const navigate = useNavigate()
  const { activeTab, setTab, activeModal, openModal } = useUIStore()
  const { original, draft, resetCount, computeChanges, resetDraft } = useCompanyStore()
  const addToast = useToastStore(s => s.addToast)
  const [modalMode, setModalMode] = useState<'commit' | 'discard'>('commit')

/*  const blocker = useBlocker(() => {
    if (!original || !draft) return false
    return JSON.stringify(original) !== JSON.stringify(draft)
  })
*/

/*
  const handleDiscard = useCallback(() => {
    resetDraft()
    blocker.proceed?.()
  }, [resetDraft, blocker])

  const handleStay = useCallback(() => {
    blocker.reset?.()
  }, [blocker])
*/

// ===== CUSTOM BLOCKER HOOK - Temporary replacement until Data Router migration =====
function useNavigationBlocker(shouldBlock: boolean) {
  const navigate = useNavigate();
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  const block = useCallback((destination: string) => {
    if (shouldBlock) {
      setPendingNavigation(destination);
      setShowModal(true);
      return true;
    }
    return false;
  }, [shouldBlock]);
  
  const proceed = useCallback(() => {
    if (pendingNavigation) {
      setShowModal(false);
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [pendingNavigation, navigate]);
  
  const reset = useCallback(() => {
    setShowModal(false);
    setPendingNavigation(null);
  }, []);
  
  return { 
    block, 
    proceed, 
    reset, 
    state: showModal ? 'blocked' : 'unblocked' 
  };
}
// ===== END CUSTOM HOOK =====

// hasUnsavedChanges
const hasUnsavedChanges = !!(original && draft && 
  JSON.stringify(original) !== JSON.stringify(draft));

const blocker = useNavigationBlocker(hasUnsavedChanges);

// handleDiscard
const handleDiscard = useCallback(() => {
  resetDraft()
  blocker.proceed()
}, [resetDraft, blocker])

const handleStay = useCallback(() => {
  blocker.reset()
}, [blocker])


  const handleSave = useCallback(() => {
    setModalMode('commit')
    computeChanges()
    openModal('commit')
  }, [setModalMode, computeChanges, openModal])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const ActiveTab = TAB_COMPONENTS[activeTab]

  if (!draft) return <div className="editor-loading">Loading...</div>

  return (
    <div className="company-editor">

      <Topbar
        breadcrumb={
          <>
            <span
              style={{ cursor: 'pointer', color: 'var(--color-text-secondary)' }}
              onClick={() => {
                if (!blocker.block('/companies')) {
                  navigate('/companies');
                }
              }}
            >
              Home
            </span>
            {' › '}
            <span
              style={{ cursor: 'pointer', color: 'var(--color-text-secondary)' }}
              onClick={() => {
                if (!blocker.block('/companies')) {
                  navigate('/companies');
                }
              }}
            >
              Companies
            </span>
            {' › '}
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{draft?.name_en || 'Untitled'}</span>
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => {
              if (!original || !draft || computeDiff(original, draft).length === 0) {
                addToast('No changes to discard', 'info')
                return
              }
              setModalMode('discard')
              openModal('commit')
            }}>
              Discard
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              Save changes
            </Button>
          </>
        }
      />

      <div className="editor-body">
        <div className="editor-main">
          <div className="editor-company-header">
              <h1>{draft.name_en}</h1>
              <div className="input-box editor-company-id">
                <span className="font-semibold">Company ID</span>
                <span className="text-gray-500">{draft.id}</span>
              </div>
            </div>
          <TabBar tabs={TABS} active={activeTab} onChange={setTab} />
          <div className="editor-canvas" key={resetCount}>
            <ActiveTab />
          </div>
        </div>
        <MetadataPanel />
      </div>

      {activeModal === 'commit'      && <CommitModal mode={modalMode} />}
      {activeModal === 'json-export' && <JSONExportModal />}
      {activeModal === 'json-import'    && <JSONImportModal />}
      {activeModal === 'annual-report' && <AnnualReportModal />}
      {blocker.state === 'blocked' && (
        <UnsavedChangesModal
          companyName={original?.name_en || 'this company'}
          onDiscard={handleDiscard}
          onStay={handleStay}
        />
      )}
    </div>
  )
}
