import { memo, useState, useCallback } from 'react'
import { useCompanyStore } from '../../../store/company.store'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import type { CompanyContact, ContactType, EmailFormat } from '../../../types/company.types'

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

interface ContactFormState {
  name: string
  position: string
  email: string
  phone: string
  fax: string
  contact_type: ContactType
  email_format: EmailFormat
  notes: string
}

const EMPTY_FORM: ContactFormState = {
  name: '',
  position: '',
  email: '',
  phone: '',
  fax: '',
  contact_type: 'freetext',
  email_format: 'html',
  notes: ''
}

function contactToForm(c: CompanyContact): ContactFormState {
  return {
    name: c.name,
    position: c.position ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    fax: c.fax ?? '',
    contact_type: c.contact_type,
    email_format: c.email_format,
    notes: c.notes ?? ''
  }
}

interface ContactFormProps {
  initial: ContactFormState
  onSave: (data: ContactFormState) => void
  onCancel: () => void
  onDelete?: () => void
}

function ContactForm({ initial, onSave, onCancel, onDelete }: ContactFormProps) {
  const [form, setForm] = useState<ContactFormState>(initial)
  const set = (field: keyof ContactFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="contact-form">
      <div className="contact-form__row contact-form__row--3">
        <Field label="Contact name" value={form.name} onChange={e => set('name', e.target.value)} />
        <Field label="Position" value={form.position} onChange={e => set('position', e.target.value)} />
        <Field label="Email" value={form.email} onChange={e => set('email', e.target.value)} />
      </div>
      <div className="contact-form__row contact-form__row--4">
        <Field label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
        <Field label="Fax" value={form.fax} onChange={e => set('fax', e.target.value)} />
        <div className="field">
          <label className="label field">Contact Type</label>
          <select className="field__select" value={form.contact_type} onChange={e => set('contact_type', e.target.value as ContactType)}>
            <option value="freetext">Freetext</option>
            <option value="html">HTML</option>
            <option value="pdf">PDF</option>
          </select>
        </div>
        <div className="field">
          <label className="label field">Email Format</label>
          <select className="field__select" value={form.email_format} onChange={e => set('email_format', e.target.value as EmailFormat)}>
            <option value="html">HTML</option>
            <option value="text">Text</option>
          </select>
        </div>
      </div>
      <div className="contact-form__notes">
        <label className="label field">Notes</label>
        <textarea
          className="contact-form__textarea"
          placeholder="Internal notes about the contact..."
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
        />
      </div>
      <div className="contact-form__divider" />
      <div className="contact-form__actions">
        <Button variant="danger" size="sm" onClick={onCancel}>✕ Cancel entry</Button>
        {onDelete && <Button variant="danger" size="sm" onClick={onDelete}>Delete entry</Button>}
        <Button variant="outline" size="sm" onClick={() => onSave(form)}>Save changes</Button>
      </div>
    </div>
  )
}

const ContactsTab = memo(function ContactsTab() {
  const draft = useCompanyStore(s => s.draft)
  const updateDraft = useCompanyStore(s => s.updateDraft)

  const [openId, setOpenId] = useState<number | null>(null)
  const [addingNew, setAddingNew] = useState(false)

  const toggleOpen = useCallback((id: number) => {
    setOpenId(prev => prev === id ? null : id)
  }, [])

  const handleSaveExisting = useCallback((id: number, data: ContactFormState) => {
    if (!draft) return
    const updated = draft.contacts.map(c =>
      c.id === id ? { ...c, ...data, position: data.position || null, email: data.email || null, phone: data.phone || null, fax: data.fax || null, notes: data.notes || null } : c
    )
    updateDraft({ contacts: updated })
    setOpenId(null)
  }, [draft, updateDraft])

  const handleDelete = useCallback((id: number) => {
    if (!draft) return
    updateDraft({ contacts: draft.contacts.filter(c => c.id !== id) })
    setOpenId(null)
  }, [draft, updateDraft])

  const handleAddNew = useCallback((data: ContactFormState) => {
    if (!draft) return
    const newContact: CompanyContact = {
      id: Date.now(),
      company_id: draft.id,
      name: data.name,
      position: data.position || null,
      email: data.email || null,
      phone: data.phone || null,
      fax: data.fax || null,
      contact_type: data.contact_type,
      email_format: data.email_format,
      notes: data.notes || null,
      sort_order: draft.contacts.length + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    updateDraft({ contacts: [...draft.contacts, newContact] })
    setAddingNew(false)
  }, [draft, updateDraft])

  if (!draft) return null

  return (
    <div className="tab-content">
      <div className="contacts-header">
        <span className="contacts-header__title">Contact List</span>
        <div className="contacts-header__actions">
          <Button variant="outline" size="sm" onClick={() => { setAddingNew(true); setOpenId(null) }}>
            + Add contact
          </Button>
          <Button variant="outline" size="sm">
            ↓ Import from CSV
          </Button>
        </div>
      </div>

      {addingNew && (
        <div className="contact-card">
          <div className="label form-title">Add new contact</div>
          <ContactForm
            initial={EMPTY_FORM}
            onSave={handleAddNew}
            onCancel={() => setAddingNew(false)}
          />
        </div>
      )}

      <div className="contact-list">
        {draft.contacts.map(contact => (
          <div key={contact.id} className="contact-card">
            <div className="contact-card__row" onClick={() => toggleOpen(contact.id)}>
              <div className="contact-avatar">{getInitials(contact.name)}</div>
              <div className="contact-card__info">
                <span >{contact.name}</span>
                <span className="hint">
                  {[contact.position, contact.email].filter(Boolean).join(' • ')}
                </span>
              </div>
              <svg
                className="contact-card__chevron"
                width="24" height="24" viewBox="0 0 24 24" fill="none"
                style={{ transform: openId === contact.id ? 'rotate(180deg)' : undefined }}
              >
                <path d="M6 9L12 15L18 9" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {openId === contact.id && (
              <ContactForm
                initial={contactToForm(contact)}
                onSave={(data) => handleSaveExisting(contact.id, data)}
                onCancel={() => setOpenId(null)}
                onDelete={() => handleDelete(contact.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

export default ContactsTab
