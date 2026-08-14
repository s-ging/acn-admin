import { memo, useState } from 'react'
import { CollapsibleGroup } from '../../../ui/CollapsibleGroup'
import { DateTimeField } from '../../../ui/DateTimeField'
import { ARTICLE_STATUSES } from '../../../../lib/press-releases/options'
import { addCompany, removeCompany, setPrimaryIssuer } from '../../../../lib/press-releases/companies'
import type { ArticleStatus } from '../../../../types/press-release.types'
import type { CompanyFull } from '../../../../types/company.types'
import type { GroupProps } from './GroupProps'

type IssuerSort = 'name' | 'id' | 'issuer'

const SORT_STORAGE_KEY = 'acn_issuer_sort'

const SORT_LABELS: Record<IssuerSort, string> = {
  issuer: 'Primary issuer first',
  name: 'Company name',
  id: 'Company ID',
}

function readStoredSort(): IssuerSort {
  const stored = localStorage.getItem(SORT_STORAGE_KEY)
  return stored === 'name' || stored === 'id' || stored === 'issuer' ? stored : 'issuer'
}

function CrownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M1 3.2l2.2 2L6 1.6l2.8 3.6L11 3.2 10 9.6H2L1 3.2z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const AVATAR_COLOR_CLASSES = [
  'avatar-color-0', 'avatar-color-1', 'avatar-color-2',
  'avatar-color-3', 'avatar-color-4', 'avatar-color-5',
]

function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function CompanyMark({ company }: { company: CompanyFull }) {
  const logo = company.logo_article_url ?? company.logo_top_url
  if (logo) {
    return <img className="company-avatar company-avatar--xs" src={logo} alt="" style={{ objectFit: 'contain' }} />
  }
  return (
    <div className={`company-avatar company-avatar--xs ${AVATAR_COLOR_CLASSES[company.id % 6]}`}>
      {initials(company.name_en)}
    </div>
  )
}

/**
 * Group 1 — the things you actually touch. The company list sits here rather
 * than down in Relations because everything in Classification is computed from
 * it.
 *
 * Every company on the release carries the same weight; one wears the crown as
 * primary issuer, and that one sets the Sector.
 */
export const PublicationGroup = memo(({ draft, update, companies }: GroupProps) => {
  const [sort, setSort] = useState<IssuerSort>(readStoredSort)

  const byId = (id: number) => companies.find(c => c.id === id) ?? null

  const changeSort = (next: IssuerSort) => {
    setSort(next)
    localStorage.setItem(SORT_STORAGE_KEY, next)
  }

  // Display order only. `company_ids` keeps its own order, because that is what
  // decides the order of the derived Industry chips — sorting the table must
  // not quietly reclassify the release.
  const rows = draft.company_ids
    .map(id => ({ id, company: byId(id), isIssuer: id === draft.primary_issuer_id }))
    .sort((a, b) => {
      if (sort === 'id') return a.id - b.id
      if (sort === 'name') {
        return (a.company?.name_en ?? '').localeCompare(b.company?.name_en ?? '')
      }
      if (a.isIssuer !== b.isIssuer) return a.isIssuer ? -1 : 1
      return (a.company?.name_en ?? '').localeCompare(b.company?.name_en ?? '')
    })

  const issuerName = draft.primary_issuer_id !== null
    ? byId(draft.primary_issuer_id)?.name_en
    : undefined

  return (
    <CollapsibleGroup title="Publication" meta={issuerName}>

      <DateTimeField
        label="Date"
        value={draft.published_at}
        onChange={iso => update({ published_at: iso })}
      />

      <div className="metadata-panel__section">
        <span className="label">Status</span>
        <select
          className="metadata-status-select"
          value={draft.status}
          onChange={e => update({ status: e.target.value as ArticleStatus })}
        >
          {ARTICLE_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="metadata-panel__section">
        <div className="metadata-kv">
          <span className="label">Companies</span>
          {rows.length > 1 && (
            <>
              <span className="label faded issuer-sort-label">Sort by</span>
              <select
                className="issuer-sort"
                value={sort}
                aria-label="Sort companies by"
                onChange={e => changeSort(e.target.value as IssuerSort)}
              >
                {(Object.keys(SORT_LABELS) as IssuerSort[]).map(key => (
                  <option key={key} value={key}>{SORT_LABELS[key]}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {rows.length === 0 ? (
          <span className="chip-list__empty">No companies on this release.</span>
        ) : (
          <div className="data-table issuer-table">
            <div className="data-table__header issuer-grid">
              <span title="Primary issuer" />
              <span />
              <span>Company</span>
              <span>ID</span>
              <span />
            </div>

            {rows.map(({ id, company, isIssuer }) => {
              const name = company?.name_en ?? `Unknown company #${id}`

              return (
                <div
                  key={id}
                  className={`data-table__row issuer-grid${isIssuer ? ' issuer-row--primary' : ''}`}
                >
                  <button
                    type="button"
                    className={`issuer-row__crown${isIssuer ? ' issuer-row__crown--on' : ''}`}
                    title={isIssuer ? 'Primary issuer — sets the Sector' : 'Set as primary issuer'}
                    aria-label={isIssuer ? `${name} is the primary issuer` : `Set ${name} as primary issuer`}
                    aria-pressed={isIssuer}
                    onClick={() => update(setPrimaryIssuer(draft, id))}
                  >
                    <CrownIcon />
                  </button>

                  {company
                    ? <CompanyMark company={company} />
                    : <span className="company-avatar company-avatar--xs">?</span>}

                  <span title={name}>{name}</span>

                  <span className="data-table__secondary">{id}</span>

                  <div className="data-table__row-actions">
                    <button
                      type="button"
                      className="chip__remove"
                      aria-label={`Remove ${name}`}
                      title={`Remove ${name} from this release`}
                      onClick={() => update(removeCompany(draft, id))}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <select
          className="metadata-status-select"
          value=""
          onChange={e => {
            if (e.target.value) update(addCompany(draft, Number(e.target.value)))
            e.currentTarget.value = ''
          }}
        >
          <option value="">+ Add company…</option>
          {companies
            .filter(c => !draft.company_ids.includes(c.id))
            .map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
        </select>

        <span className="hint">
          Every company here is credited and adds its sector to Industry. The
          crowned one is the primary issuer — whose release this is — and it
          alone sets the Sector.
        </span>
      </div>

    </CollapsibleGroup>
  )
})

PublicationGroup.displayName = 'PublicationGroup'
