import { memo } from 'react'

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  className?: string
}

export const Badge = memo(({ label, variant = 'neutral', className }: BadgeProps) => {
  return (
    <span className={`badge badge--${variant} ${className ?? ''}`}>
      {label}
    </span>
  )
})

Badge.displayName = 'Badge'
