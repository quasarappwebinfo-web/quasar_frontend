import { createContext } from 'react'
import type { SyncConflict, SyncMeta, SyncRunSummary } from '@/sync/model/types'

export type SyncContextValue = {
  online: boolean
  syncing: boolean
  pendingCount: number
  conflicts: SyncConflict[]
  meta: SyncMeta
  lastError: string | null
  refreshSnapshot: () => Promise<void>
  runSync: (opts?: { obraId?: number }) => Promise<SyncRunSummary | null>
  dismissConflict: (uuid: string) => Promise<void>
}

export const SyncContext = createContext<SyncContextValue | null>(null)
