import { getSyncDb, STORE } from '@/sync/db/database'
import { idbReq, idbTxDone } from '@/sync/lib/idb'
import type { PhotoBlobRecord, SyncConflict } from '@/sync/model/types'

type EntityStore =
  | typeof STORE.tasks
  | typeof STORE.comments
  | typeof STORE.delays
  | typeof STORE.photos
  | typeof STORE.reschedules

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function ensureUuid(
  record: Record<string, unknown>,
  fallbackUuid?: string,
): string | null {
  const uuid = record.uuid ?? fallbackUuid
  return typeof uuid === 'string' && uuid.length > 0 ? uuid : null
}

export async function upsertEntity(
  store: EntityStore,
  record: Record<string, unknown>,
  fallbackUuid?: string,
): Promise<void> {
  const uuid = ensureUuid(record, fallbackUuid)
  if (!uuid) return
  const db = await getSyncDb()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put({ ...record, uuid })
  await idbTxDone(tx)
}

export async function upsertMany(
  store: EntityStore,
  rows: Record<string, unknown>[],
): Promise<number> {
  let count = 0
  for (const row of rows) {
    const rec = asRecord(row)
    if (!rec) continue
    const uuid = ensureUuid(rec)
    if (!uuid) continue
    await upsertEntity(store, rec)
    count += 1
  }
  return count
}

export async function putPhotoBlob(record: PhotoBlobRecord): Promise<void> {
  const db = await getSyncDb()
  const tx = db.transaction(STORE.photoBlobs, 'readwrite')
  tx.objectStore(STORE.photoBlobs).put(record)
  await idbTxDone(tx)
}

export async function getPhotoBlob(
  photoUuid: string,
): Promise<PhotoBlobRecord | null> {
  const db = await getSyncDb()
  const row = await idbReq<PhotoBlobRecord | undefined>(
    db
      .transaction(STORE.photoBlobs, 'readonly')
      .objectStore(STORE.photoBlobs)
      .get(photoUuid),
  )
  return row ?? null
}

export async function deletePhotoBlob(photoUuid: string): Promise<void> {
  const db = await getSyncDb()
  const tx = db.transaction(STORE.photoBlobs, 'readwrite')
  tx.objectStore(STORE.photoBlobs).delete(photoUuid)
  await idbTxDone(tx)
}

export async function putConflict(conflict: SyncConflict): Promise<void> {
  const db = await getSyncDb()
  const tx = db.transaction(STORE.conflicts, 'readwrite')
  tx.objectStore(STORE.conflicts).put(conflict)
  await idbTxDone(tx)
}

export async function listConflicts(): Promise<SyncConflict[]> {
  const db = await getSyncDb()
  return idbReq(
    db.transaction(STORE.conflicts, 'readonly').objectStore(STORE.conflicts).getAll(),
  )
}

export async function clearConflict(uuid: string): Promise<void> {
  const db = await getSyncDb()
  const tx = db.transaction(STORE.conflicts, 'readwrite')
  tx.objectStore(STORE.conflicts).delete(uuid)
  await idbTxDone(tx)
}

export async function acceptServerConflict(
  conflict: SyncConflict,
): Promise<void> {
  if (conflict.serverRecord) {
    const entity = conflict.entity
    if (entity === 'task_comment') {
      await upsertEntity(STORE.comments, conflict.serverRecord, conflict.uuid)
    } else if (entity === 'task_delay') {
      await upsertEntity(STORE.delays, conflict.serverRecord, conflict.uuid)
    } else if (entity === 'task_photo') {
      await upsertEntity(STORE.photos, conflict.serverRecord, conflict.uuid)
    } else if (entity === 'task_status' || entity === 'task_reschedule') {
      await upsertEntity(STORE.tasks, conflict.serverRecord, conflict.uuid)
    }
  }
  await clearConflict(conflict.uuid)
}

export async function listLocalTaskRecords(): Promise<Record<string, unknown>[]> {
  const db = await getSyncDb()
  const rows = await idbReq<Record<string, unknown>[]>(
    db.transaction(STORE.tasks, 'readonly').objectStore(STORE.tasks).getAll(),
  )
  return rows ?? []
}
