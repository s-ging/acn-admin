import { memo, useState } from 'react'
import { CollapsibleGroup } from '../../../ui/CollapsibleGroup'
import { Button } from '../../../ui/Button'
import { SUPPLIERS } from '../../../../lib/press-releases/options'
import { LANGUAGE_NAMES } from '../../../../lib/languages'
import type { LanguageCode } from '../../../../types/company.types'
import type { ArticleContact } from '../../../../types/press-release.types'
import type { GroupProps } from './GroupProps'

const nextContactId = (contacts: ArticleContact[]) =>
  contacts.reduce((max, c) => Math.max(max, c.id), 0) + 1

/**
 * Group 4 — everyone else attached to the release. The companies themselves
 * live in Publication, since the classification is computed from them.
 */
export const RelationsGroup = memo(({ draft, update, companies }: GroupProps) => {
  const [editingLanguage, setEditingLanguage] = useState<LanguageCode | null>(null)

  const byId = (id: number) => companies.find(c => c.id === id) ?? null

  // Contacts are picked from the companies already on the release rather than
  // typed again — the details already exist on the company record.
  const contactPool = draft.company_ids
    .map(byId)
    .filter(Boolean)
    .flatMap(company => company!.contacts.map(contact => ({ company: company!, contact })))
    .filter(({ contact }) => !draft.contacts.some(c => c.email === contact.email && c.name === contact.name))

  const addContact = (key: string) => {
    const found = contactPool.find(({ company, contact }) => `${company.id}:${contact.id}` === key)
    if (!found) return
    const { contact } = found
    update({
      contacts: [...draft.contacts, {
        id: nextContactId(draft.contacts),
        name: contact.name,
        position: contact.position,
        email: contact.email,
        phone: contact.phone,
      }],
    })
  }

  const removeContact = (id: number) => {
    update({ contacts: draft.contacts.filter(c => c.id !== id) })
  }

  // One row per language the release is tagged with, plus any translation
  // already recorded against a language that has since been untagged.
  const translationLanguages: LanguageCode[] = [
    ...draft.languages,
    ...draft.secondary_languages,
    ...draft.translations.map(t => t.language),
  ].filter((code, i, all) => all.indexOf(code) === i)

  const setTranslation = (language: LanguageCode, url: string | null) => {
    const existing = draft.translations.some(t => t.language === language)
    update({
      translations: existing
        ? draft.translations.map(t => (t.language === language ? { ...t, url } : t))
        : [...draft.translations, { language, url }],
    })
  }

  return (
    <CollapsibleGroup
      title="Relations"
      meta={draft.contacts.length > 0 ? `${draft.contacts.length} contacts` : undefined}
    >

      <div className="metadata-panel__section">
        <span className="label">Supplier</span>
        <select
          className="metadata-status-select"
          value={draft.supplier ?? ''}
          onChange={e => update({ supplier: e.target.value || null })}
        >
          <option value="">— None —</option>
          {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Contacts */}
      <div className="metadata-panel__section">
        <span className="label">Contacts</span>
        <div className="contact-list">
          {draft.contacts.map(contact => (
            <div key={contact.id} className="contact-card">
              <div className="contact-card__row">
                <div className="contact-card__info">
                  <span className="label field">{contact.name}</span>
                  <span className="hint">
                    {[contact.position, contact.email].filter(Boolean).join(' · ') || '—'}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeContact(contact.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {draft.contacts.length === 0 && (
            <span className="chip-list__empty">No contacts on this release.</span>
          )}
        </div>
        <select
          className="metadata-status-select"
          value=""
          onChange={e => { addContact(e.target.value); e.currentTarget.value = '' }}
          disabled={contactPool.length === 0}
        >
          <option value="">
            {draft.company_ids.length === 0
              ? 'Add a company in Publication first'
              : contactPool.length === 0
                ? 'No contacts left to add'
                : '+ Add contact from company…'}
          </option>
          {contactPool.map(({ company, contact }) => (
            <option key={`${company.id}:${contact.id}`} value={`${company.id}:${contact.id}`}>
              {contact.name} — {company.name_en}
            </option>
          ))}
        </select>
      </div>

      {/* Translations */}
      <div className="metadata-panel__section">
        <span className="label">Translations</span>
        {translationLanguages.length === 0 ? (
          <span className="chip-list__empty">Tag a language above to add a translation.</span>
        ) : (
          translationLanguages.map(code => {
            const translation = draft.translations.find(t => t.language === code)
            const editing = editingLanguage === code

            return (
              <div key={code} className="translation-row">
                <span className="label" title={LANGUAGE_NAMES[code]}>{code}</span>

                {editing ? (
                  <input
                    type="url"
                    className="metadata-input"
                    autoFocus
                    defaultValue={translation?.url ?? ''}
                    placeholder="https://…"
                    onBlur={e => {
                      setTranslation(code, e.target.value.trim() || null)
                      setEditingLanguage(null)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setEditingLanguage(null)
                    }}
                  />
                ) : translation?.url ? (
                  <>
                    <a
                      className="translation-row__link"
                      href={translation.url}
                      target="_blank"
                      rel="noreferrer"
                      title={translation.url}
                    >
                      {translation.url}
                    </a>
                    <Button variant="ghost" size="sm" onClick={() => setEditingLanguage(code)}>Edit</Button>
                  </>
                ) : (
                  <>
                    <span className="translation-row__empty">Not published</span>
                    <Button variant="ghost" size="sm" onClick={() => setEditingLanguage(code)}>Add link +</Button>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

    </CollapsibleGroup>
  )
})

RelationsGroup.displayName = 'RelationsGroup'
