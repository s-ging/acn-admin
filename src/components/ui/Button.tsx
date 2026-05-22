import { memo } from 'react'
import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
}

export const Button = memo(({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) => {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${className ?? ''}`}
      {...props}
    >
      {children}
    </button>
  )
})

Button.displayName = 'Button'
