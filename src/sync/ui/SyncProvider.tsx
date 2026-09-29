import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/auth'
import {
  clearConflict,
  getSyncSnapshot,
  runSyncCycle,
} from '@/sync/lib/syncEngine'
import type { SyncConflict, SyncMeta, SyncRunSummary } from '@/sync/model/types'
import { SyncContext, type SyncContextValue } from './syncContext'

const EMPTY_META: SyncMeta = {
  lastServerTime: null,
  lastSyncAt: null,
  lastSyncError: null,
  lastPushApplied: 0,
  lastPushConflicts: 0,
  lastPushErrors: 0,
}

const SYNC_INTERVAL_MS = 60_000

type SyncProviderProps = {
  children: ReactNode
}

export function SyncProvider({ children }: SyncProviderProps) {
  const { status } = useAuth()
  const authenticated = status === 'authenticated'

  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [meta, setMeta] = useState<SyncMeta>(EMPTY_META)
  const [lastError, setLastError] = useState<string | null>(null)

  const refreshSnapshot = useCallback(async () => {
    try {
      const snap = await getSyncSnapshot()
      setPendingCount(snap.pendingCount)
      setConflicts(snap.conflicts)
      setMeta(snap.meta)
      setLastError(snap.meta.lastSyncError)
    } catch {
      // IndexedDB no disponible
    }
  }, [])

  const runSync = useCallback(
    async (opts?: { obraId?: number }): Promise<SyncRunSummary | null> => {
      if (!authenticated || !navigator.onLine) {
        await refreshSnapshot()
        return null
      }
      setSyncing(true)
      setLastError(null)
      try {
        const summary = await runSyncCycle(opts)
        await refreshSnapshot()
        return summary
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync falló'
        setLastError(message)
        await refreshSnapshot()
        return null
      } finally {
        setSyncing(false)
      }
    },
    [authenticated, refreshSnapshot],
  )

  const dismissConflict = useCallback(
    async (uuid: string) => {
      await clearConflict(uuid)
      await refreshSnapshot()
    },
    [refreshSnapshot],
  )

  useEffect(() => {
    void refreshSnapshot()
  }, [refreshSnapshot])

  useEffect(() => {
    function onOnline() {
      setOnline(true)
      if (authenticated) void runSync()
    }
    function onOffline() {
      setOnline(false)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [authenticated, runSync])

  useEffect(() => {
    if (!authenticated || !online) return
    void runSync()
    const timer = window.setInterval(() => {
      void runSync()
    }, SYNC_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [authenticated, online, runSync])

  const value = useMemo<SyncContextValue>(
    () => ({
      online,
      syncing,
      pendingCount,
      conflicts,
      meta,
      lastError,
      refreshSnapshot,
      runSync,
      dismissConflict,
    }),
    [
      online,
      syncing,
      pendingCount,
      conflicts,
      meta,
      lastError,
      refreshSnapshot,
      runSync,
      dismissConflict,
    ],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
