import { memo } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { useDebouncedDraft } from '../../../hooks/useDebouncedDraft'
import { Field } from '../../ui/Field'
import { AboutBlock } from '../../ui/AboutBlock'

const BasicInfoTab = memo(function BasicInfoTab() {
  const draft = useCompanyStore(s => s.draft)
  const update = useDebouncedDraft()

  if (!draft) return null

  return (
    <div className="tab-content">

      <section className="field-section">
        <Field
          label="Company Name (EN)"
          defaultValue={draft.name_en}
          onChange={e => update({ name_en: e.target.value })}
        />
      </section>

      <section className="field-section">
        <div className="field-row">
          <Field
            label="Company Name (ZH-HANS)"
            defaultValue={draft.name_zh_hans ?? ''}
            placeholder="Write the headline..."
            onChange={e => update({ name_zh_hans: e.target.value || null })}
          />
          <Field
            label="Company Name (ZH-HANT)"
            defaultValue={draft.name_zh_hant ?? ''}
            placeholder="Write the subheadline..."
            onChange={e => update({ name_zh_hant: e.target.value || null })}
          />
        </div>
      </section>

      <section className="field-section">
        <div className="field-row">
          <Field
            label="Company Name (JA)"
            defaultValue={draft.name_ja ?? ''}
            placeholder="Write the headline..."
            onChange={e => update({ name_ja: e.target.value || null })}
          />
          <Field
            label="Company Name (KO)"
            defaultValue={draft.name_ko ?? ''}
            placeholder="Write the subheadline..."
            onChange={e => update({ name_ko: e.target.value || null })}
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
              <p className="logo-upload-zone__text">
                Drag and drop image files here or{' '}
                <label className="logo-upload-zone__link">
                  upload files from your computer.
                  <input type="file" accept=".svg,.png,.jpg,.gif,.webp" hidden />
                </label>
              </p>
              <p className="hint">
                File formats accepted: .svg, .png, .jpg, .gif, .webp<br />
                Maximum 3MB for all file types. Minimum 1000px width or less for non-SVG formats.
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
              <p className="logo-upload-zone__text">
                Drag and drop image files here or{' '}
                <label className="logo-upload-zone__link">
                  upload files from your computer.
                  <input type="file" accept=".svg,.png,.jpg,.gif,.webp" hidden />
                </label>
              </p>
              <p className="hint">
                File formats accepted: .svg, .png, .jpg, .gif, .webp<br />
                Maximum 3MB for all file types. Minimum 1000px width or less for non-SVG formats.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="field-section">
        <AboutBlock
          label="About Company"
          subtitle="Shown at the bottom of every press release the company releases."
          html={draft.about_html}
          onChange={html => update({ about_html: html })}
        />
      </section>

      <section className="field-section">
        <AboutBlock
          label="Extended About Boilerplate"
          subtitle={'Shown when "Show Extended" is enabled. Appended after the main boilerplate on press release pages.'}
          html={null}
          onChange={html => update({ about_html: html })}
        />
      </section>

    </div>
  )
})

export default BasicInfoTab
