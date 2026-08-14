import { memo } from 'react'

interface DateTimeFieldProps {
  label: string
  /** ISO timestamp, or null when unset. */
  value: string | null
  onChange: (iso: string | null) => void
  hint?: string
}

/**
 * A native datetime-local input styled to match .metadata-status-select, so
 * the sidebar gets a real date control without a new dependency.
 *
 * The input speaks local wall-clock time in `YYYY-MM-DDTHH:mm`; the draft
 * stores ISO. Both conversions live here so nothing else has to know.
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export const DateTimeField = memo(({ label, value, onChange, hint }: DateTimeFieldProps) => (
  <div className="metadata-panel__section">
    <span className="label">{label}</span>
    <input
      type="datetime-local"
      className="metadata-input"
      value={toLocalInput(value)}
      onChange={e => onChange(fromLocalInput(e.target.value))}
    />
    {hint && <span className="hint">{hint}</span>}
  </div>
))

DateTimeField.displayName = 'DateTimeField'
