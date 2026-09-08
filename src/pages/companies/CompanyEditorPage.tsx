import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../../store/company.store'
import CompanyEditor from '../../components/company/CompanyEditor'
import { normalizeCompany } from '../../lib/companies/normalize'
import { useCompanyRecord } from '../../hooks/useRecords'

export default function CompanyEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { setOriginal, original } = useCompanyStore()
  const navigate = useNavigate()

  const numericId = id && /^\d+$/.test(id) ? parseInt(id, 10) : null

  // The record comes from whichever source has it: the API for a company on the
  // wire, localStorage for one created or edited here. `loadCompanyRecord`
  // decides — the editor doesn't need to know. Opening a company straight from
  // its URL works now, where before it needed a localStorage hit.
  const { data: company, isLoading, isFetched } = useCompanyRecord(numericId)

  // Which company id has been handed to the store. `setOriginal` replaces the
  // draft as well as the original, so calling it twice for one company would
  // throw away whatever had been typed in between — and it *would* be called
  // twice, since the list page seeds the store before navigating and the fetch
  // then resolves underneath the open editor.
  const seededId = useRef<number | null>(null)

  useEffect(() => {
    if (numericId === null) { navigate('/companies'); return }
    if (seededId.current === numericId) return

    // The list page may already have seeded this company. Nothing to do until
    // the fetch has something better, or has come back with nothing.
    if (!company) {
      if (isFetched && !isLoading && original?.id !== numericId) navigate('/companies')
      return
    }

    const normalized = normalizeCompany(company)
    // A base64 annual report only ever comes from a local upload, and it is far
    // too large to carry around in editor state.
    if (normalized.annual_report_url?.startsWith('data:')) {
      normalized.annual_report_url = null
    }

    seededId.current = numericId
    setOriginal(normalized)
  }, [numericId, company, isLoading, isFetched, original?.id, navigate, setOriginal])

  // Guard against rendering the previous company's data for a moment while a
  // different id is still loading.
  if (!original || original.id !== numericId) return null
  return <CompanyEditor />
}
