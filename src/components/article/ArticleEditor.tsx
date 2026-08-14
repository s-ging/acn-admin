import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useArticleStore } from '../../store/article.store'
import { useToastStore } from '../../store/toast.store'
import { saveArticle } from '../../lib/press-releases/storage'
import { loadCompany } from '../../lib/companies/storage'
import { Topbar } from '../ui/Topbar'
import { Button } from '../ui/Button'
import ArticleCanvas from './canvas/ArticleCanvas'
import { ArticleMetadataPanel } from './panels/ArticleMetadataPanel'

export default function ArticleEditor() {
  const navigate = useNavigate()
  const { original, draft, resetCount, resetDraft, commitSuccess, setOriginal } = useArticleStore()
  const addToast = useToastStore(s => s.addToast)

  const dirty = !!(original && draft && JSON.stringify(original) !== JSON.stringify(draft))

  // The canvas names the primary issuer — whose release this is. The panel owns
  // changing it.
  const issuerId = draft?.primary_issuer_id ?? null
  const issuerName = useMemo(
    () => (issuerId ? loadCompany(issuerId)?.name_en ?? null : null),
    [issuerId]
  )
  const otherCompanyCount = (draft?.company_ids.length ?? 0) - (issuerId ? 1 : 0)

  const handleSave = useCallback(() => {
    const current = useArticleStore.getState().draft
    if (!current) return
    if (!dirty) {
      addToast('No changes to save', 'info')
      return
    }
    const saved = { ...current, updated_at: new Date().toISOString() }
    const result = saveArticle(saved)
    if (!result.ok) {
      // Leave the draft dirty — nothing was written, so there is still work to save.
      addToast(result.message, 'error', 6000)
      return
    }
    setOriginal(saved)
    commitSuccess()
    addToast('Press release saved', 'success')
  }, [dirty, addToast, setOriginal, commitSuccess])

  const handleDiscard = useCallback(() => {
    if (!dirty) {
      addToast('No changes to discard', 'info')
      return
    }
    resetDraft()
    addToast('Changes discarded', 'info')
  }, [dirty, resetDraft, addToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  if (!draft) return <div className="editor-loading">Loading...</div>

  return (
    <div className="article-editor">

      <Topbar
        breadcrumb={
          <>
            <span
              style={{ cursor: 'pointer', color: 'var(--color-text-secondary)' }}
              onClick={() => navigate('/companies')}
            >
              Home
            </span>
            {' › '}
            <span
              style={{ cursor: 'pointer', color: 'var(--color-text-secondary)' }}
              onClick={() => navigate('/article')}
            >
              Press Releases
            </span>
            {' › '}
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
              {draft.headline || 'Untitled'}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={handleDiscard}>Discard</Button>
            <Button variant="primary" size="sm" onClick={handleSave}>Save changes</Button>
          </>
        }
      />

      <div className="editor-body">
        <div className="editor-main">

          <div className="editor-company-header">
            <h1>{draft.headline ? 'Edit Press Release' : 'Create Press Release'}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="input-box editor-company-id">
                <span className="font-semibold">Primary issuer</span>
                <span className="text-gray-500">
                  {issuerName ?? '—'}
                  {otherCompanyCount > 0 && ` +${otherCompanyCount}`}
                </span>
              </div>
              <div className="input-box editor-company-id">
                <span className="font-semibold">Article ID</span>
                <span className="text-gray-500">{draft.article_id}</span>
              </div>
            </div>
          </div>

          <div className="editor-canvas" key={resetCount}>
            <ArticleCanvas />
          </div>
        </div>

        {/* Keyed alongside the canvas: the sidebar's free-text inputs are
            uncontrolled too, so they need the same flush after a discard. */}
        <ArticleMetadataPanel key={resetCount} />
      </div>

    </div>
  )
}
