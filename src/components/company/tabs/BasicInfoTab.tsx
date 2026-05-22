import { useCompanyStore } from '../../../store/company.store'
import { Field } from '../../ui/Field'

export default function BasicInfoTab() {
  const draft = useCompanyStore(s => s.draft)
  const updateDraft = useCompanyStore(s => s.updateDraft)

  if (!draft) return null

  return (
    <div className="tab-content">

      <section className="field-section">
        <Field
          label="Company Name (EN)"
          value={draft.name_en}
          onChange={e => updateDraft({ name_en: e.target.value })}
        />
      </section>

      <section className="field-section">
        <div className="field-row">
          <Field
            label="Company Name (ZH-HANS)"
            value={draft.name_zh_hans ?? ''}
            placeholder="Write the headline..."
            onChange={e => updateDraft({ name_zh_hans: e.target.value || null })}
          />
          <Field
            label="Company Name (ZH-HANT)"
            value={draft.name_zh_hant ?? ''}
            placeholder="Write the subheadline..."
            onChange={e => updateDraft({ name_zh_hant: e.target.value || null })}
          />
        </div>
      </section>

      <section className="field-section">
        <div className="field-row">
          <Field
            label="Company Name (JA)"
            value={draft.name_ja ?? ''}
            placeholder="Write the headline..."
            onChange={e => updateDraft({ name_ja: e.target.value || null })}
          />
          <Field
            label="Company Name (KO)"
            value={draft.name_ko ?? ''}
            placeholder="Write the subheadline..."
            onChange={e => updateDraft({ name_ko: e.target.value || null })}
          />
        </div>
      </section>

      <section className="field-section">
        <div className="field-row">
          <div className="logo-upload-zone">
            <span className="label field">Article Page Logo</span>
            <div className="logo-upload-zone__box">
              <div className="logo-upload-zone__icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <p>
                Drag and drop image files here or{' '}
                <label className="logo-upload-zone__link">
                  upload files from your computer.
                  <input type="file" accept=".svg,.png,.jpg,.gif,.webp" hidden />
                </label>
              </p>
              <p className="hint">
                File formats accepted: .svg, .png, .jpg, .gif, .webp<br />
                Maximum 3MB for all file types. Minimum 220px width or less for non-SVG formats.
              </p>
            </div>
          </div>

          <div className="logo-upload-zone">
            <span className="label field">Top Page Logo</span>
            <div className="logo-upload-zone__box">
              <div className="logo-upload-zone__icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <p>
                Drag and drop image files here or{' '}
                <label className="logo-upload-zone__link">
                  upload files from your computer.
                  <input type="file" accept=".svg,.png,.jpg,.gif,.webp" hidden />
                </label>
              </p>
              <p className="hint">
                File formats accepted: .svg, .png, .jpg, .gif, .webp<br />
                Maximum 3MB for all file types. Minimum 68px width or less for non-SVG formats.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="field-section">
        <div className="about-block">
          <div className="about-block__header">
            <span className="label field">About Company</span>
            <span className="hint">Shown at the bottom of every press release the company releases.</span>
          </div>
          <div className="about-block__body">
            {draft.about_html
              ? <div dangerouslySetInnerHTML={{ __html: draft.about_html }} />
              : <span className="about-block__empty">No content yet.</span>
            }
          </div>
        </div>
      </section>

      <section className="field-section">
        <div className="about-block">
          <div className="about-block__header">
            <span className="label field">Extended About Boilerplate</span>
            <span className="hint">Shown when "Show Extended" is enabled. Appended after the main boilerplate on press release pages.</span>
          </div>
          <div className="about-block__body">
            <span className="about-block__empty">No content yet.</span>
          </div>
        </div>
      </section>

    </div>
  )
}
