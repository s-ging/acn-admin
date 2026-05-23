import type { ReactNode } from 'react'

interface TopbarProps {
  breadcrumb: ReactNode
  actions?: ReactNode
}

export function Topbar({ breadcrumb, actions }: TopbarProps) {
  return (
    <div className="editor-topbar">
      <div className="editor-breadcrumb">{breadcrumb}</div>
      {actions && <div className="editor-topbar-right">{actions}</div>}
    </div>
  )
}
