// src/lib/api/write.ts
// Change set → requests. No diffing happens here: what to send is decided once,
// by lib/companies/diff.ts, and each change carries its own wire ops. This file
// only turns those ops into HTTP.
//
//   basicInfo / details ops  → merged into ONE PUT /api/Companies/{id}
//   industry ops             → PUT/DELETE /industries/{industryId}, ids from
//                              lib/industries.ts (sectors have no write)
//   listing ops              → POST/PUT/DELETE /listings[/{mic}/{ticker}]
//   social ops               → PUT/DELETE /social-links/{platform}

import {
  createCompany,
  createCompanyListing,
  createdId,
  deleteCompanyIndustry,
  deleteCompanyListing,
  deleteCompanySocialLink,
  saveCompanyIndustry,
  saveCompanySocialLink,
  updateCompany,
  updateCompanyListing,
} from './endpoints'
import type { ApiCompanyBasicInfo, ApiCompanyDetailsWrite } from './types'
import type { CompanyChange, WireOp } from '../companies/diff'

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** The field ops of a change set, as the two halves of the company DTO. */
export function fieldBody(ops: WireOp[]): { basicInfo: ApiCompanyBasicInfo; details: ApiCompanyDetailsWrite } {
  const basicInfo: Record<string, string> = {}
  const details: Record<string, string> = {}
  for (const op of ops) {
    if (op.kind === 'basicInfo') basicInfo[op.key] = op.value
    if (op.kind === 'details') details[op.key] = op.value
  }
  return { basicInfo, details }
}

async function runOp(companyId: number, op: WireOp): Promise<void> {
  switch (op.kind) {
    case 'industry:put':
      await saveCompanyIndustry(companyId, op.id, { isPrimary: op.isPrimary })
      return
    case 'industry:delete':
      await deleteCompanyIndustry(companyId, op.id)
      return
    case 'listing:create':
      await createCompanyListing(companyId, { mic: op.mic, ticker: op.ticker, isPrimary: op.isPrimary, sortOrder: op.sortOrder })
      return
    case 'listing:update':
      await updateCompanyListing(companyId, op.mic, op.ticker, { isPrimary: op.isPrimary, sortOrder: op.sortOrder })
      return
    case 'listing:delete':
      await deleteCompanyListing(companyId, op.mic, op.ticker)
      return
    case 'social:put':
      await saveCompanySocialLink(companyId, op.platform, { url: op.url })
      return
    case 'social:delete':
      await deleteCompanySocialLink(companyId, op.platform)
      return
    case 'basicInfo':
    case 'details':
      return // sent together, below
  }
}

/**
 * Sends every API-bound change. Returns one message per failed request rather
 * than throwing — whether a change landed is decided afterwards by re-fetching
 * and diffing, not by which requests answered 200.
 */
export async function sendChanges(companyId: number, changes: CompanyChange[]): Promise<string[]> {
  const ops = changes.filter(c => c.sync === 'api').flatMap(c => c.ops)
  const failures: string[] = []

  const { basicInfo, details } = fieldBody(ops)
  const hasBasic = Object.keys(basicInfo).length > 0
  const hasDetails = Object.keys(details).length > 0
  if (hasBasic || hasDetails) {
    try {
      await updateCompany(companyId, {
        ...(hasBasic ? { basicInfo } : {}),
        ...(hasDetails ? { details } : {}),
      })
    } catch (err) {
      failures.push(`company fields: ${message(err)}`)
    }
  }

  for (const op of ops) {
    if (op.kind === 'basicInfo' || op.kind === 'details') continue
    try {
      await runOp(companyId, op)
    } catch (err) {
      failures.push(`${op.kind}: ${message(err)}`)
    }
  }
  return failures
}

/**
 * `POST /api/Companies` for a company created here. Sends the field ops only;
 * sectors, listings and Instagram go afterwards through `sendChanges`, against
 * the id this returns. Throws if the API gives no id back — the caller must not
 * retry blindly then, or it may create the company twice.
 */
export async function createFromChanges(name: string, changes: CompanyChange[]): Promise<number> {
  const { basicInfo, details } = fieldBody(changes.filter(c => c.sync === 'api').flatMap(c => c.ops))
  const response = await createCompany({ basicInfo: { ...basicInfo, companyNameEN: name }, details })
  const id = createdId(response)
  if (id === null) {
    throw new Error('The API accepted the new company but did not return its id. Check the company list before trying again — a retry may create it twice.')
  }
  return id
}
