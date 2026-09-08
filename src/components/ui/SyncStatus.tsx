// src/components/ui/SyncStatus.tsx
// Where the rows on screen came from, and a way to go and get fresher ones.
//
// This exists because cache-first loading is invisible by default, and invisible
// caching is the kind that gets blamed for stale data. If the list was served
// from IndexedDB, the person reading it should be able to see that, see how old
// it is, and override it — without having to guess whether a refresh did
// anything.
//
// "Offline" is inferred from the load falling back to the cache, not from
// navigator.onLine, which reports a live network interface rather than whether
// the API answered.

interface SyncStatusProps {
  /** Where the records came from. Undefined while the first load is in flight. */
  origin?: 'cache' | 'network' | 'local'
  /** When the wire data was fetched, epoch ms. Null if it never was. */
  syncedAt: number | null
  /** A fetch is in flight — the refresh control shows it rather than going dead. */
  busy?: boolean
  onRefresh: () => void
}

/** "just now", "4 min ago", "3 h ago", "2 d ago". */
function relativeTime(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

export function SyncStatus({ origin, syncedAt, busy, onRefresh }: SyncStatusProps) {
  const label = (() => {
    if (busy) return 'Syncing…'
    if (origin === 'local') return 'Offline · local records only'
    if (syncedAt === null) return 'Not synced'
    if (origin === 'cache') return `Cached · ${relativeTime(syncedAt)}`
    return `Synced · ${relativeTime(syncedAt)}`
  })()

  return (
    <span className="sync-status" style={{ marginLeft: 'auto' }}>
      <span
        className={`sync-status__dot sync-status__dot--${busy ? 'busy' : origin ?? 'unknown'}`}
        aria-hidden="true"
      />
      <span className="sync-status__label">{label}</span>
      <button
        type="button"
        className="sync-status__refresh"
        onClick={onRefresh}
        disabled={busy}
        title="Fetch fresh records from the newswire, ignoring the cache"
      >
        Refresh
      </button>
    </span>
  )
}
