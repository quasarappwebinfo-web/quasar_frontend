import { useContext } from 'react'
import { SyncContext, type SyncContextValue } from './syncContext'

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext)
  if (!ctx) {
    throw new Error('useSync debe usarse dentro de SyncProvider')
  }
  return ctx
}
