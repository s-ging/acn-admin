// src/lib/list/alphabet.ts
// Which A–Z bucket a name belongs to.
//
// Split out from <AlphabetIndex> so the component file exports only a component
// — the list pages need this function to build the set of available letters and
// to filter rows, and a file mixing the two breaks fast refresh.

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/**
 * The bucket a name belongs to: its uppercased first letter, or '#'.
 *
 * '#' covers everything that doesn't start with a Latin letter, which on this
 * wire is mostly CJK headlines and names starting with a digit. Grouping them
 * under one heading beats scattering them or dropping them.
 */
export function initialOf(name: string | null | undefined): string {
  const first = name?.trim()[0]
  if (!first) return '#'
  const upper = first.toUpperCase()
  return LETTERS.includes(upper) ? upper : '#'
}
