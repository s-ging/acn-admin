import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../../store/company.store'
import CompanyEditor from '../../components/company/CompanyEditor'
import type { CompanyFull } from '../../types/company.types'

export default function CompanyEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { setOriginal, original } = useCompanyStore()
  const navigate = useNavigate()

  useEffect(() => {
    const stored = localStorage.getItem(`acn_company_${id}`)
    if (!stored) { navigate('/companies'); return }
    try {
      const company = JSON.parse(stored) as CompanyFull
      setOriginal(company)
    } catch {
      navigate('/companies')
    }
  }, [id])

  if (!original) return null
  return <CompanyEditor />
}
