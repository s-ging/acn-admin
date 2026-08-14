import { memo } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { useDebouncedDraft } from '../../../hooks/useDebouncedDraft'
import { Field } from '../../ui/Field'
import { AboutBlock } from '../../ui/AboutBlock'
import { LogoUpload } from '../LogoUpload'

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
        <div className="field-row field-row--2">
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
        <div className="field-row field-row--2">
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
        <div className="field-row field-row--2">
          <LogoUpload
            companyId={draft.id}
            field="logo_article_url"
            label="Article page logo"
          />
          <LogoUpload
            companyId={draft.id}
            field="logo_top_url"
            label="Top page logo"
          />
        </div>
      </section>

      <section className="field-section">
        <AboutBlock
          label="About Company"
          subtitle="Shown at the bottom of every press release the company releases."
          html={draft.about_html}
          onChange={html => update({ about_html: html })}
          variant="basic"
        />
      </section>

      <section className="field-section">
        <AboutBlock
          label="Extended About Boilerplate"
          subtitle={'Shown when "Show Extended" is enabled. Appended after the main boilerplate on press release pages.'}
          html={null}
          onChange={html => update({ about_html: html })}
          variant="basic"
        />
      </section>

    </div>
  )
})

export default BasicInfoTab
