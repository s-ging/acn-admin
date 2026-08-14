import { memo } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { useDebouncedDraft } from '../../../hooks/useDebouncedDraft'
import { Field } from '../../ui/Field'

const CompanyDetailsTab = memo(function CompanyDetailsTab() {
  const draft = useCompanyStore(s => s.draft)
  const update = useDebouncedDraft()

  if (!draft) return null

  return (
    <div className="tab-content">

      {/* Company Profile */}
      <section className="field-section">
        <div className="section-label">Company Profile</div>
        <div className="field-row field-row--3" style={{ marginTop: 16 }}>
          <Field label="Established" defaultValue={draft.established ?? ''} placeholder="e.g. 1971/02/01" onChange={e => update({ established: e.target.value || null } as never)} />
          <Field label="Exchange Listed Date" defaultValue={draft.exchange_listed_date ?? ''} placeholder="e.g. 1971/02/01" onChange={e => update({ exchange_listed_date: e.target.value || null } as never)} />
          <Field label="Employees" defaultValue={draft.employees ?? ''} placeholder="e.g. 1000+" onChange={e => update({ employees: e.target.value || null } as never)} />
        </div>
        <div className="field-row field-row--3" style={{ marginTop: 24 }}>
          <Field label="DUNS number" defaultValue={draft.duns_number ?? ''} placeholder="e.g. 00-123-4567" onChange={e => update({ duns_number: e.target.value || null } as never)} />
          <Field label="OTC" defaultValue={draft.otc ?? ''} placeholder="https://www.mhi.com/news" onChange={e => update({ otc: e.target.value || null } as never)} />
          <Field label="Market ID" defaultValue={draft.market_id ?? ''} placeholder="https://www.mhi.com/news" onChange={e => update({ market_id: e.target.value || null } as never)} />
        </div>
      </section>

      {/* Company Links */}
      <section className="field-section">
        <div className="section-label">Company Links</div>
        <div className="field-row field-row--3" style={{ marginTop: 16 }}>
          <Field label="Company Website" defaultValue={draft.url ?? ''} onChange={e => update({ url: e.target.value || null } as never)} />
          <Field label="Company Website (JA)" defaultValue={draft.url_ja ?? ''} onChange={e => update({ url_ja: e.target.value || null } as never)} />
          <Field label="Blog" defaultValue={draft.blog ?? ''} onChange={e => update({ blog: e.target.value || null } as never)} />
        </div>
        <div className="field-row field-row--3" style={{ marginTop: 24 }}>
          <Field label="Facebook" defaultValue={draft.facebook ?? ''} onChange={e => update({ facebook: e.target.value || null } as never)} />
          <Field label="Twitter" defaultValue={draft.twitter ?? ''} onChange={e => update({ twitter: e.target.value || null } as never)} />
          <Field label="Instagram" defaultValue={draft.instagram ?? ''} onChange={e => update({ instagram: e.target.value || null } as never)} />
        </div>
        <div className="field-row field-row--3" style={{ marginTop: 24 }}>
          <Field label="LinkedIn" defaultValue={draft.linkedin ?? ''} onChange={e => update({ linkedin: e.target.value || null } as never)} />
          <Field label="YouTube" defaultValue={draft.youtube ?? ''} onChange={e => update({ youtube: e.target.value || null } as never)} />
          <Field label="Telegram" defaultValue={draft.telegram ?? ''} onChange={e => update({ telegram: e.target.value || null } as never)} />
        </div>
      </section>

      {/* Company Address */}
      <section className="field-section">
        <div className="section-label">Company Address</div>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Field label="Street" defaultValue={draft.address_street ?? ''} placeholder="e.g. 2-3, Marunouchi 3-chome" onChange={e => update({ address_street: e.target.value || null } as never)} />
          <Field label="District" defaultValue={draft.address_district ?? ''} placeholder="e.g. Chiyoda-ku" onChange={e => update({ address_district: e.target.value || null } as never)} />
          <Field label="City" defaultValue={draft.address_city ?? ''} placeholder="e.g. Tokyo 100-8332" onChange={e => update({ address_city: e.target.value || null } as never)} />
          <Field label="Country" defaultValue={draft.address_country ?? ''} placeholder="e.g. Japan" onChange={e => update({ address_country: e.target.value || null } as never)} />
        </div>
        <div className="field-row field-row--3" style={{ marginTop: 24 }}>
          <Field label="Company Telephone" defaultValue={draft.telephone ?? ''} placeholder="+81 3 0000 0000" onChange={e => update({ telephone: e.target.value || null } as never)} />
          <Field label="Facsimile" defaultValue={draft.facsimile ?? ''} placeholder="+81 3 0000 0000" onChange={e => update({ facsimile: e.target.value || null } as never)} />
          <Field label="Company Email" defaultValue={draft.company_email ?? ''} placeholder="e.g. hello@mhi.com.jp" onChange={e => update({ company_email: e.target.value || null } as never)} />
        </div>
      </section>

      {/* Key Personnel */}
      <section className="field-section">
        <div className="field-row field-row--2" style={{ marginBottom: 24 }}>
          <Field label="Key Personnel 1 Name" defaultValue={draft.key_person_1_name ?? ''} onChange={e => update({ key_person_1_name: e.target.value || null } as never)} />
          <Field label="Key Personnel 1 Title" defaultValue={draft.key_person_1_title ?? ''} onChange={e => update({ key_person_1_title: e.target.value || null } as never)} />
        </div>
        <div className="field-row field-row--2">
          <Field label="Key Personnel 2 Name" defaultValue={draft.key_person_2_name ?? ''} onChange={e => update({ key_person_2_name: e.target.value || null } as never)} />
          <Field label="Key Personnel 2 Title" defaultValue={draft.key_person_2_title ?? ''} onChange={e => update({ key_person_2_title: e.target.value || null } as never)} />
        </div>
      </section>

    </div>
  )
})

export default CompanyDetailsTab
