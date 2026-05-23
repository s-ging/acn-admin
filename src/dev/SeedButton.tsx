import { useCompanyStore } from '../store/company.store'
import { SEED_COMPANY, seedLocalStorage, clearSeed } from './seed'

export function SeedButton() {
  if (!import.meta.env.DEV) return null

  const setOriginal = useCompanyStore(s => s.setOriginal)

  function handleReseed() {
    seedLocalStorage()
    setOriginal(SEED_COMPANY)
    window.location.reload()
  }

  function handleClear() {
    clearSeed()
    window.location.reload()
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: 16,
      zIndex: 400,
      display: 'flex',
      gap: 6,
    }}>
      <button onClick={handleReseed} style={pillStyle}>↺ Re-seed MHI</button>
      <button onClick={handleClear}  style={pillStyle}>✕ Clear seed</button>
    </div>
  )
}

const pillStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 9999,
  border: '1px solid #555',
  background: '#1a1a1a',
  color: '#ccc',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
