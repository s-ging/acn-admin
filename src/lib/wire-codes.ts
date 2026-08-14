// src/lib/wire-codes.ts
// Shared helpers for turning a wire code into a CompanyWireCode row, so codes
// added by hand in the Identifiers tab and codes added by sector routing end up
// with the same shape and the same wire_code_id.

import { REUTERS_CODES } from './reuters-codes'
import { BLOOMBERG_CODES } from './bloomberg-codes'
import type { CompanyWireCode, WireSource } from '../types/company.types'

// The two sources that have a static master list of codes.
export type CodedWireSource = Extract<WireSource, 'reuters' | 'bloomberg'>

export interface WireCodeItem {
  code: string
  description: string
  category: string
}

// djb2 — a given code string always resolves to the same id, so the same code
// can never be added twice under two different ids.
export function codeHash(code: string): number {
  let h = 5381
  for (let i = 0; i < code.length; i++) h = (h * 33) ^ code.charCodeAt(i)
  return h >>> 0
}

export function lookupWireCode(source: CodedWireSource, code: string): WireCodeItem | undefined {
  const list = source === 'reuters' ? REUTERS_CODES : BLOOMBERG_CODES
  return list.find(c => c.code === code)
}

export function makeWireCodeRow(
  source: CodedWireSource,
  item: WireCodeItem,
  companyId: number
): CompanyWireCode {
  const codeId = codeHash(item.code)
  return {
    id: Date.now() + codeId,
    company_id: companyId,
    wire_code_id: codeId,
    wire_code: {
      id: codeId,
      source,
      code_type: item.category,
      code: item.code,
      name: item.description,
    },
  }
}

// Builds a row from the master list. Returns null for a code that isn't in the
// list, so a stale routing entry can't inject a code with no description.
export function wireCodeFromMaster(
  source: CodedWireSource,
  code: string,
  companyId: number
): CompanyWireCode | null {
  const item = lookupWireCode(source, code)
  return item ? makeWireCodeRow(source, item, companyId) : null
}
