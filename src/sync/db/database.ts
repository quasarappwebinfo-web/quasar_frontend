import { idbReq, idbTxDone, openDatabase } from '@/sync/lib/idb'

export const SYNC_DB_NAME = 'quasar-sync'
export const SYNC_DB_VERSION = 1

export const STORE = {
  meta: 'meta',
  outbox: 'outbox',
  photoBlobs: 'photoBlobs',
  tasks: 'tasks',
  comments: 'comments',
  delays: 'delays',
  photos: 'photos',
  reschedules: 'reschedules',
  conflicts: 'conflicts',
} as const

let dbPromise: Promise<IDBDatabase> | null = null

export function getSyncDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase(SYNC_DB_NAME, SYNC_DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains(STORE.meta)) {
        db.createObjectStore(STORE.meta, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE.outbox)) {
        const outbox = db.createObjectStore(STORE.outbox, { keyPath: 'opId' })
        outbox.createIndex('status', 'status', { unique: false })
        outbox.createIndex('uuid', 'uuid', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE.photoBlobs)) {
        db.createObjectStore(STORE.photoBlobs, { keyPath: 'photoUuid' })
      }
      for (const name of [
        STORE.tasks,
        STORE.comments,
        STORE.delays,
        STORE.photos,
        STORE.reschedules,
        STORE.conflicts,
      ] as const) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'uuid' })
        }
      }
    })
  }
  return dbPromise
}

export async function metaGet<T>(key: string): Promise<T | null> {
  const db = await getSyncDb()
  const row = await idbReq<{ key: string; value: T } | undefined>(
    db.transaction(STORE.meta, 'readonly').objectStore(STORE.meta).get(key),
  )
  return row ? row.value : null
}

export async function metaSet<T>(key: string, value: T): Promise<void> {
  const db = await getSyncDb()
  const tx = db.transaction(STORE.meta, 'readwrite')
  tx.objectStore(STORE.meta).put({ key, value })
  await idbTxDone(tx)
}
