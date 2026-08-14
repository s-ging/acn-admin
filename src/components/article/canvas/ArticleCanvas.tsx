import { memo, useCallback } from 'react'
import { useArticleStore } from '../../../store/article.store'
import { useDebouncedArticleDraft } from '../../../hooks/useDebouncedArticleDraft'
import { Field } from '../../ui/Field'
import { AboutBlock } from '../../ui/AboutBlock'
import {
  parseDateline,
  applyDateline,
  composeDateline,
  applyAutoDateline,
} from '../../../lib/press-releases/dateline'

/**
 * The writing surface. Canvas controls are the underlined <Field> style
 * throughout — the boxed style belongs to the sidebar.
 *
 * Text fields are uncontrolled + debounced (pattern A), so the editor remounts
 * this on resetCount to flush them after a discard.
 */
const ArticleCanvas = memo(function ArticleCanvas() {
  const draft = useArticleStore(s => s.draft)
  const updateDraft = useArticleStore(s => s.updateDraft)
  const update = useDebouncedArticleDraft()

  const setBody = useCallback((html: string) => updateDraft({ body_html: html }), [updateDraft])
  const setCustomAbout = useCallback((html: string) => updateDraft({ custom_about_html: html }), [updateDraft])

  // Typing a dateline by hand takes it off the automatic one for good — the
  // same bargain the Classification override makes.
  const commitDateline = useCallback((value: string) => {
    const current = useArticleStore.getState().draft
    if (!current) return
    if (value.trim() === (parseDateline(current.body_html) ?? '')) return

    updateDraft({
      body_html: applyDateline(current.body_html, value),
      dateline_overridden: true,
    })
  }, [updateDraft])

  const followLocation = useCallback(() => {
    const current = useArticleStore.getState().draft
    if (!current) return
    const released = { ...current, dateline_overridden: false }
    updateDraft({ dateline_overridden: false, ...applyAutoDateline(released) })
  }, [updateDraft])

  if (!draft) return null

  const dateline = parseDateline(draft.body_html)
  const composed = composeDateline(draft.location, draft.published_at)

  return (
    <div className="tab-content">

      <section className="field-section">
        <div className="field-row field-row--2">
          <Field
            label="Headline"
            defaultValue={draft.headline}
            placeholder="e.g. Toyota and Honda Announce Joint Hydrogen Mobility Initiative"
            onChange={e => update({ headline: e.target.value })}
          />
          <Field
            label="Subheadline"
            defaultValue={draft.subheadline ?? ''}
            placeholder="One supporting line, shown under the headline"
            onChange={e => update({ subheadline: e.target.value || null })}
          />
        </div>
      </section>

      <section className="field-section">
        <div className="contact-form__notes">
          <label className="label field">Summary</label>
          <textarea
            className="contact-form__textarea"
            defaultValue={draft.summary ?? ''}
            placeholder="The opening paragraph wire subscribers see before the full release."
            onChange={e => update({ summary: e.target.value || null })}
          />
        </div>
      </section>

      {/* Not a field of its own — this reads and writes the opening of the body,
          which is where the dateline actually lives. Commits on blur rather
          than per keystroke, because each commit rewrites the body's HTML. */}
      <section className="field-section">
        <Field
          key={dateline ?? ''}
          label="Dateline"
          defaultValue={dateline ?? ''}
          placeholder="TOKYO, August 14, 2020"
          onBlur={e => commitDateline(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
        <div className="metadata-kv" style={{ marginTop: 4 }}>
          <span className="hint">
            {draft.dateline_overridden
              ? 'Written by hand. It opens the body text and no longer follows Location.'
              : 'Follows Location and Date. It opens the body text.'}
          </span>
          {draft.dateline_overridden && composed && composed !== dateline && (
            <span
              className="label faded clickable"
              role="button"
              tabIndex={0}
              title={`Go back to following Location and Date — "${composed}"`}
              onClick={followLocation}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') followLocation() }}
            >
              Use location
            </span>
          )}
        </div>
      </section>

      <section className="field-section">
        <AboutBlock
          label="Main Content"
          subtitle="The body of the release. Images, tables and alignment are available in the toolbar."
          html={draft.body_html}
          onChange={setBody}
          placeholder="Write the release. Datelines go at the top of the first paragraph."
        />
      </section>

      <section className="field-section">
        <AboutBlock
          label="Custom About"
          subtitle="Replaces the company boilerplate on this release only. Leave empty to use the company's own About text."
          html={draft.custom_about_html}
          onChange={setCustomAbout}
          variant="basic"
        />
      </section>

    </div>
  )
})

export default ArticleCanvas
