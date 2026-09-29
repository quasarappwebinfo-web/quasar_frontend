import { getSyncDb, STORE } from '@/sync/db/database'
import { idbReq, idbTxDone } from '@/sync/lib/idb'
import type { OutboxItem, OutboxStatus } from '@/sync/model/types'

export async function putOutboxItem(item: OutboxItem): Promise<void> {
  const db = await getSyncDb()
  const tx = db.transaction(STORE.outbox, 'readwrite')
  tx.objectStore(STORE.outbox).put(item)
  await idbTxDone(tx)
}

export async function getOutboxItem(opId: string): Promise<OutboxItem | null> {
  const db = await getSyncDb()
  const row = await idbReq<OutboxItem | undefined>(
    db.transaction(STORE.outbox, 'readonly').objectStore(STORE.outbox).get(opId),
  )
  return row ?? null
}

export async function listOutboxByStatus(
  statuses: OutboxStatus[],
): Promise<OutboxItem[]> {
  const db = await getSyncDb()
  const all = await idbReq<OutboxItem[]>(
    db.transaction(STORE.outbox, 'readonly').objectStore(STORE.outbox).getAll(),
  )
  const set = new Set(statuses)
  return all
    .filter((item) => set.has(item.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function countPendingOutbox(): Promise<number> {
  const items = await listOutboxByStatus([
    'pending',
    'needs_upload',
    'error',
  ])
  return items.length
}

export async function updateOutboxItem(
  opId: string,
  patch: Partial<OutboxItem>,
): Promise<OutboxItem | null> {
  const current = await getOutboxItem(opId)
  if (!current) return null
  const next = { ...current, ...patch }
  await putOutboxItem(next)
  return next
}
