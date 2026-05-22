import { memo, forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export const Field = memo(forwardRef<HTMLInputElement, FieldProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <div className={`field ${error ? 'field--error' : ''} ${className ?? ''}`}>
        <label className="label field">{label}</label>
        <input
          ref={ref}
          className="field__input"
          {...props}
        />
        {error && <span className="field__error">{error}</span>}
        {hint && !error && <span className="hint">{hint}</span>}
      </div>
    )
  }
))

Field.displayName = 'Field'
