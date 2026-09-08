import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useArticleStore } from '../../store/article.store'
import ArticleEditor from '../../components/article/ArticleEditor'
import { createArticle } from '../../lib/press-releases/normalize'
import { saveArticle, generateArticleId } from '../../lib/press-releases/storage'
import { useArticleRecord } from '../../hooks/useRecords'

export default function ArticleEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { setOriginal, original } = useArticleStore()
  const navigate = useNavigate()

  const numericId = id && /^\d+$/.test(id) ? parseInt(id, 10) : null

  // The release comes from whichever source has it: the API for one already on
  // the wire, localStorage for a draft written here. `loadArticleRecord` decides.
  const { data: article, isLoading, isFetched } = useArticleRecord(numericId)

  // See the note in CompanyEditorPage — `setOriginal` replaces the draft, so
  // each release is seeded exactly once.
  const seededId = useRef<number | null>(null)

  useEffect(() => {
    // /article/new writes a blank record and redirects, so the editor only ever
    // deals with a release that has an id. The API has no write path, so a new
    // release is local from the start.
    if (id === 'new') {
      const blank = createArticle(generateArticleId())
      saveArticle(blank)
      seededId.current = blank.id
      setOriginal(blank)
      navigate(`/article/${blank.id}`, { replace: true })
      return
    }

    if (numericId === null) { navigate('/article'); return }
    if (seededId.current === numericId) return

    if (!article) {
      if (isFetched && !isLoading && original?.id !== numericId) navigate('/article')
      return
    }

    seededId.current = numericId
    setOriginal(article)
  }, [id, numericId, article, isLoading, isFetched, original?.id, navigate, setOriginal])

  if (!original || (numericId !== null && original.id !== numericId)) return null
  return <ArticleEditor />
}
