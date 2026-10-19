/**
 * The commit flow: send, re-fetch, keep only what didn't land.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { blankCompany } from './blank'
import { loadBase, loadDraft, resetMigrationForTests, saveDraft } from './storage'
import type { CompanyFull } from '../../types/company.types'

// What the "API" holds, and what a PUT is allowed to change in it.
let server: CompanyFull
let accepts: (keyof CompanyFull)[] = []

vi.mock('../api/repository', () => ({
  fetchCompanyBase: vi.fn(async () => structuredClone(server)),
  patchCachedCompany: vi.fn(async () => {}),
}))
vi.mock('../api/write', () => ({
  sendChanges: vi.fn(async (_id: number, changes: { patch: { kind: string; path?: string; value?: unknown } }[]) => {
    for (const { patch } of changes) {
      if (patch.kind === 'set' && accepts.includes(patch.path as keyof CompanyFull)) {
        server = { ...server, [patch.path!]: patch.value }
      }
    }
    return []
  }),
}))

const { commitCompany } = await import('./sync')

const company = (over: Partial<CompanyFull> = {}): CompanyFull =>
  ({ ...blankCompany(82, 'MHI'), created_at: '', updated_at: '', ...over })

beforeEach(() => {
  localStorage.clear()
  resetMigrationForTests()
})

describe('commitCompany', () => {
  it('deletes the draft once the re-fetch shows every change landed', async () => {
    const base = company()
    server = base
    accepts = ['telephone']
    const draft = { ...base, telephone: '03-1234' }
    saveDraft(draft)

    const result = await commitCompany(base, draft)

    expect(result).toMatchObject({ status: 'done', draft: null, unlanded: [] })
    expect(loadDraft(82)).toBeNull()
    expect(loadBase(82)?.telephone).toBe('03-1234')
  })

  it('keeps exactly what did not land as the draft, so a retry resends only that', async () => {
    const base = company()
    server = base
    accepts = ['telephone'] // the API drops the fax
    const draft = { ...base, telephone: '03-1234', facsimile: '03-9999', status: 'inactive' as const }
    saveDraft(draft)

    const result = await commitCompany(base, draft)
    if (result.status !== 'done') throw new Error(result.status)

    expect(result.unlanded.map(c => c.key)).toEqual(['field:facsimile'])
    expect(result.localOnly.map(c => c.key)).toEqual(['field:status'])
    // The stored draft is the new base plus those two — nothing else.
    expect(loadDraft(82)).toMatchObject({ telephone: '03-1234', facsimile: '03-9999', status: 'inactive' })
  })

  it('stops on a conflict without sending anything', async () => {
    const base = company({ telephone: '1' })
    server = company({ telephone: '3' })
    accepts = ['telephone']
    const draft = { ...base, telephone: '2' }

    const result = await commitCompany(base, draft)

    expect(result).toMatchObject({ status: 'conflict', conflicts: [{ key: 'field:telephone', mine: '2', theirs: '3' }] })
    expect(server.telephone).toBe('3')
  })
})
