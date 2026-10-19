import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../../store/company.store'
import CompanyEditor from '../../components/company/CompanyEditor'
import { emptyBase } from '../../lib/companies/sync'
import { loadDraft } from '../../lib/companies/storage'
import { useCompanyRecord } from '../../hooks/useRecords'

export default function CompanyEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { open, original } = useCompanyStore()
  const navigate = useNavigate()

  const numericId = id && /^\d+$/.test(id) ? parseInt(id, 10) : null

  // The API version (base) and any uncommitted draft, separately — the editor
  // diffs one against the other. See loadCompanyRecord.
  const { data: record, isLoading, isFetched } = useCompanyRecord(numericId)

  // Which company id has been handed to the store, so a refetch underneath the
  // open editor doesn't replace what is being typed.
  const seededId = useRef<number | null>(null)

  useEffect(() => {
    if (numericId === null) { navigate('/companies'); return }
    if (seededId.current === numericId) return
    if (!record) {
      if (isFetched && !isLoading) navigate('/companies')
      return
    }

    // A company created here has no API version yet: everything in it is new.
    // Opened offline with nothing cached, the draft stands in as its own base —
    // no diff to show, and the commit compares against a fresh fetch instead.
    // The draft is read from storage now, not from the query: React Query may
    // hand back a record cached minutes ago, and the autosaved draft is newer.
    const draft = loadDraft(numericId)
    const isNew = !!draft?.created_at
    const base = record.base ?? (isNew ? emptyBase(numericId) : draft)
    if (!base) { navigate('/companies'); return }
    seededId.current = numericId
    open(base, draft, !record.base && !isNew)
  }, [numericId, record, isLoading, isFetched, navigate, open])

  // Guard against rendering the previous company's data for a moment while a
  // different id is still loading.
  if (!original || original.id !== numericId) return null
  return <CompanyEditor />
}
