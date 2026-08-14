import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useArticleStore } from '../../store/article.store'
import ArticleEditor from '../../components/article/ArticleEditor'
import { createArticle } from '../../lib/press-releases/normalize'
import { loadArticle, saveArticle, generateArticleId } from '../../lib/press-releases/storage'

export default function ArticleEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { setOriginal, original } = useArticleStore()
  const navigate = useNavigate()

  useEffect(() => {
    // /article/new writes a blank record and redirects, so the editor only ever
    // deals with a release that has an id.
    if (id === 'new') {
      const article = createArticle(generateArticleId())
      saveArticle(article)
      setOriginal(article)
      navigate(`/article/${article.id}`, { replace: true })
      return
    }

    const article = loadArticle(id ?? '')
    if (!article) { navigate('/article'); return }
    setOriginal(article)
  }, [id])

  if (!original) return null
  return <ArticleEditor />
}
