import { useEffect } from 'react'
import { useCompanyStore } from '../../store/company.store'
import { useUIStore } from '../../store/ui.store'
import { TabBar } from '../ui/TabBar'
import { MetadataPanel } from './panels/MetadataPanel'
import { Button } from '../ui/Button'
import { MOCK_COMPANY } from '../../lib/mock'
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
  const { activeTab, setTab } = useUIStore()
  const { draft, setOriginal, resetDraft } = useCompanyStore()

  useEffect(() => {
    setOriginal(MOCK_COMPANY)
  }, [setOriginal])

  const ActiveTab = TAB_COMPONENTS[activeTab]

  if (!draft) return <div className="editor-loading">Loading...</div>

  return (
    <div className="company-editor">
      <div className="editor-main">

        <div className="editor-topbar">
          <div className="editor-breadcrumb">
            Companies &rsaquo; <strong>{draft.name_en}</strong>
          </div>
          <div className="editor-topbar-right">
            <Button variant="ghost" size="sm" onClick={resetDraft}>
              Discard
            </Button>
            <Button variant="primary" size="sm">
              Save changes
            </Button>
          </div>
        </div>

        <h1>{draft.name_en}</h1>

        <TabBar tabs={TABS} active={activeTab} onChange={setTab} />

        <div className="editor-canvas">
          <ActiveTab />
        </div>

      </div>
      <MetadataPanel />
    </div>
  )
}
