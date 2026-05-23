import { useEffect, useState } from 'react'
import CompanyEditor from './components/company/CompanyEditor'
import ModalPreview from './components/dev/ModalPreview'
import { ToastContainer } from './components/ui/Toast'
import { useCompanyStore } from './store/company.store'
import { SEED_COMPANY, seedLocalStorage } from './dev/seed'
import { SeedButton } from './dev/SeedButton'
import type { CompanyFull } from './types/company.types'

export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  const setOriginal = useCompanyStore(s => s.setOriginal)

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const key = `acn_company_${SEED_COMPANY.id}`
    const stored = localStorage.getItem(key)

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CompanyFull
        setOriginal(parsed)
      } catch {
        seedLocalStorage()
        setOriginal(SEED_COMPANY)
      }
    } else {
      seedLocalStorage()
      setOriginal(SEED_COMPANY)
    }
  }, [])

  return (
    <>
      {hash === '#dev' ? <ModalPreview /> : <CompanyEditor />}
      <ToastContainer />
      <SeedButton />
    </>
  )
}
