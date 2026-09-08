// src/lib/api/cache.ts
// The persistent read cache: IndexedDB, keyed by whatever the repository asked for.
//
// Why not localStorage, which everything else here uses? Capacity. The wire
// holds 9,439 companies, which is ~16.7 MB as CompanyFull records against a
// localStorage cap of roughly 5 MB. localStorage also stores strings only and
// is synchronous, so a 16 MB write would block the main thread outright.
// IndexedDB has neither limit.
//
// The division of labour is deliberate and worth keeping straight:
//
//   IndexedDB (here)  — a cache of what the wire said. Disposable. Deleting it
//                       costs a re-fetch and nothing else.
//   localStorage      — edits, and records created here. NOT disposable. This
//                       is the only copy, because the API is read-only.
//
// So this file never stores an edit and never needs to be migrated. If the
// shape of a cached record changes, bumping CACHE_VERSION discards the lot.

/** Bump to discard every cached entry — after a mapper change, say. */
const CACHE_VERSION = 1

const DB_NAME = 'acn-admin-cache'
const DB_VERSION = 1
const STORE = 'entries'

export interface CacheEntry<T> {
  value: T
  /** When this was written, as epoch ms. What staleness is judged against. */
  savedAt: number
}

interface StoredEntry {
  key: string
  version: number
  value: unknown
  savedAt: number
}

/**
 * The open database, or null where IndexedDB cannot be used.
 *
 * Private-browsing modes and hardened browser settings both reject `open()`,
 * and the app has to keep working without a cache rather than fail — so every
 * function here degrades to a no-op instead of throwing. Held as a promise so
 * concurrent callers share one open attempt.
 */
let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase | null>(resolve => {
    if (typeof indexedDB === 'undefined') { resolve(null); return }

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    // Another tab holding an old version open. Carry on uncached.
    request.onblocked = () => resolve(null)
  })

  return dbPromise
}

function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return openDb().then(
    db =>
      new Promise<T | null>(resolve => {
        if (!db) { resolve(null); return }

        let request: IDBRequest<T>
        try {
          request = run(db.transaction(STORE, mode).objectStore(STORE))
        } catch {
          resolve(null)
          return
        }

        request.onsuccess = () => resolve(request.result)
        // A quota failure or a closed connection. Caching is best-effort.
        request.onerror = () => resolve(null)
      })
  )
}

/** The cached value for `key`, or null when absent, stale-versioned or unreadable. */
export async function cacheGet<T>(key: string): Promise<CacheEntry<T> | null> {
  const stored = (await transact<StoredEntry | undefined>('readonly', store =>
    store.get(key) as IDBRequest<StoredEntry | undefined>
  )) as StoredEntry | null | undefined

  if (!stored || stored.version !== CACHE_VERSION) return null
  return { value: stored.value as T, savedAt: stored.savedAt }
}

/** Writes `value` under `key`. Resolves either way — a failed cache write is not an error. */
export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const entry: StoredEntry = { key, version: CACHE_VERSION, value, savedAt: Date.now() }
  await transact('readwrite', store => store.put(entry) as IDBRequest<IDBValidKey>)
}

export async function cacheDelete(key: string): Promise<void> {
  await transact('readwrite', store => store.delete(key) as unknown as IDBRequest<undefined>)
}

/**
 * Drops every entry whose key starts with `prefix`.
 *
 * Article pages are cached one key per page, so a "Refresh" has to clear the
 * whole family — `articles:page:` — rather than guess which pages were visited.
 */
export async function cacheDeletePrefix(prefix: string): Promise<void> {
  const keys = (await transact<IDBValidKey[]>('readonly', store =>
    store.getAllKeys() as IDBRequest<IDBValidKey[]>
  )) ?? []

  await Promise.all(
    keys
      .filter((key): key is string => typeof key === 'string' && key.startsWith(prefix))
      .map(cacheDelete)
  )
}

/** Drops the whole cache. Safe at any time: nothing here is a source of truth. */
export async function cacheClear(): Promise<void> {
  await transact('readwrite', store => store.clear() as unknown as IDBRequest<undefined>)
}

/** Whether an entry is old enough to be worth revalidating. */
export function isStale(entry: CacheEntry<unknown> | null, maxAgeMs: number): boolean {
  return !entry || Date.now() - entry.savedAt > maxAgeMs
}

/** The key family every article page is cached under. See cacheDeletePrefix. */
export const ARTICLE_PAGE_PREFIX = 'articles:page:'

export const cacheKeys = {
  /** Every company, as one entry — one write beats 9,439. */
  allCompanies: 'companies:all',
  articlePage: (page: number, size: number) => `${ARTICLE_PAGE_PREFIX}${page}:${size}`,
  /** The total is a property of the collection, not of any page size. */
  articleTotal: 'articles:total',
  company: (id: number) => `company:${id}`,
  article: (id: number) => `article:${id}`,
  /** Every event, as one entry — 839 of them is a small write. */
  allEvents: 'events:all',
  eventReleases: (compId: number, year: number) => `events:releases:${compId}:${year}`,
}
