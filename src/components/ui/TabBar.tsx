import { memo } from 'react'
import type { Tab } from '../../types/company.types'

interface TabConfig {
  key: Tab
  label: string
}

interface TabBarProps {
  tabs: TabConfig[]
  active: Tab
  onChange: (tab: Tab) => void
}

export const TabBar = memo(({ tabs, active, onChange }: TabBarProps) => {
  return (
    <div className="tabbar">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`tabbar__tab ${active === tab.key ? 'tabbar__tab--active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
})

TabBar.displayName = 'TabBar'
