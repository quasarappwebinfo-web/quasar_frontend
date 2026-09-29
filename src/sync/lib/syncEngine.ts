import { metaGet, metaSet, STORE } from '@/sync/db/database'
import {
  deletePhotoBlob,
  getPhotoBlob,
  listConflicts,
  putConflict,
  upsertEntity,
  upsertMany,
} from '@/sync/db/entityStore'
import {
  countPendingOutbox,
  listOutboxByStatus,
  putOutboxItem,
  updateOutboxItem,
} from '@/sync/db/outboxStore'
import {
  pullSyncChanges,
  pushSyncBatch,
  uploadSyncPhoto,
} from '@/sync/api/syncApi'
import { nowIso } from '@/sync/lib/uuid'
import type {
  OutboxItem,
  SyncMeta,
  SyncOpResult,
  SyncPushOperation,
  SyncRunSummary,
} from '@/sync/model/types'

const BATCH_SIZE = 100
const MAX_TRIES = 8
const DEFAULT_SINCE = '1970-01-01T00:00:00.000Z'

let syncInFlight: Promise<SyncRunSummary> | null = null

export async function readSyncMeta(): Promise<SyncMeta> {
  return {
    lastServerTime: (await metaGet<string>('lastServerTime')) ?? null,
    lastSyncAt: (await metaGet<string>('lastSyncAt')) ?? null,
    lastSyncError: (await metaGet<string>('lastSyncError')) ?? null,
    lastPushApplied: (await metaGet<number>('lastPushApplied')) ?? 0,
    lastPushConflicts: (await metaGet<number>('lastPushConflicts')) ?? 0,
    lastPushErrors: (await metaGet<number>('lastPushErrors')) ?? 0,
  }
}

async function saveServerTime(serverTime: string): Promise<void> {
  await metaSet('lastServerTime', serverTime)
}

async function processNeedsUpload(items: OutboxItem[]): Promise<number> {
  let uploaded = 0
  for (const item of items) {
    if (item.entity !== 'task_photo') continue
    const blobRec = await getPhotoBlob(item.uuid)
    if (!blobRec) {
      await updateOutboxItem(item.opId, {
        status: 'error',
        lastError: 'Falta el archivo local de la foto',
        tries: item.tries + 1,
      })
      continue
    }
    try {
      const result = await uploadSyncPhoto({
        taskUuid: blobRec.taskUuid,
        photoUuid: blobRec.photoUuid,
        file: blobRec.blob,
        description: blobRec.description,
      })
      await upsertEntity(STORE.photos, result.photo, item.uuid)
      await deletePhotoBlob(item.uuid)
      await updateOutboxItem(item.opId, {
        status: 'synced',
        syncedAt: nowIso(),
        lastError: null,
        serverRecord: result.photo,
        tries: item.tries + 1,
      })
      uploaded += 1
    } catch (err) {
      await updateOutboxItem(item.opId, {
        status: 'needs_upload',
        lastError: err instanceof Error ? err.message : 'Error subiendo foto',
        tries: item.tries + 1,
      })
    }
  }
  return uploaded
}

async function applyPushResults(
  items: OutboxItem[],
  results: SyncOpResult[],
): Promise<void> {
  const byOpId = new Map(items.map((item) => [item.opId, item]))
  for (const result of results) {
    const local = byOpId.get(result.opId)
    if (!local) continue

    if (result.status === 'applied' || result.status === 'idempotent') {
      if (result.serverRecord) {
        if (local.entity === 'task_comment') {
          await upsertEntity(STORE.comments, result.serverRecord, result.uuid)
        } else if (local.entity === 'task_delay') {
          await upsertEntity(STORE.delays, result.serverRecord, result.uuid)
        } else if (local.entity === 'task_photo') {
          await upsertEntity(STORE.photos, result.serverRecord, result.uuid)
        } else if (
          local.entity === 'task_status' ||
          local.entity === 'task_reschedule'
        ) {
          await upsertEntity(STORE.tasks, result.serverRecord, result.uuid)
        }
      }
      await updateOutboxItem(local.opId, {
        status: 'synced',
        syncedAt: nowIso(),
        serverId: result.serverId ?? null,
        serverRecord: result.serverRecord ?? null,
        lastError: null,
        tries: local.tries + 1,
      })
      continue
    }

    if (result.status === 'needs_upload') {
      await updateOutboxItem(local.opId, {
        status: 'needs_upload',
        uploadHint: result.uploadHint ?? '/api/v1/sync/fotos',
        lastError: null,
        tries: local.tries + 1,
      })
      continue
    }

    if (result.status === 'conflict') {
      // LWW: el servidor gana; guardamos el conflicto para aviso en UI
      if (result.serverRecord) {
        if (local.entity === 'task_comment') {
          await upsertEntity(STORE.comments, result.serverRecord, result.uuid)
        } else if (local.entity === 'task_delay') {
          await upsertEntity(STORE.delays, result.serverRecord, result.uuid)
        } else if (local.entity === 'task_photo') {
          await upsertEntity(STORE.photos, result.serverRecord, result.uuid)
        } else if (
          local.entity === 'task_status' ||
          local.entity === 'task_reschedule'
        ) {
          await upsertEntity(STORE.tasks, result.serverRecord, result.uuid)
        }
      }
      await putConflict({
        opId: local.opId,
        entity: local.entity,
        uuid: local.uuid,
        message:
          result.message ??
          'Conflicto: el servidor tenía un cambio más reciente (LWW)',
        serverRecord: result.serverRecord ?? null,
        localPayload: local.payload,
        at: nowIso(),
      })
      await updateOutboxItem(local.opId, {
        status: 'conflict',
        serverRecord: result.serverRecord ?? null,
        lastError: result.message ?? 'Conflicto LWW',
        tries: local.tries + 1,
      })
      continue
    }

    await updateOutboxItem(local.opId, {
      status: 'error',
      lastError: result.message ?? 'Error en push',
      tries: local.tries + 1,
    })
  }
}

async function pullAndMerge(since: string, obraId?: number): Promise<{
  pulled: number
  serverTime: string
}> {
  const data = await pullSyncChanges({ since, obraId })
  let pulled = 0
  pulled += await upsertMany(STORE.tasks, data.tasks)
  pulled += await upsertMany(STORE.comments, data.comments)
  pulled += await upsertMany(STORE.delays, data.delays)
  pulled += await upsertMany(STORE.photos, data.photos)
  pulled += await upsertMany(STORE.reschedules, data.reschedules)
  await saveServerTime(data.serverTime)
  return { pulled, serverTime: data.serverTime }
}

export async function runSyncCycle(options?: {
  obraId?: number
}): Promise<SyncRunSummary> {
  if (syncInFlight) return syncInFlight

  syncInFlight = (async () => {
    const summary: SyncRunSummary = {
      pushed: 0,
      applied: 0,
      conflicts: 0,
      errors: 0,
      needsUpload: 0,
      uploadedPhotos: 0,
      pulled: 0,
      serverTime: null,
    }

    try {
      // 1) Subir fotos pendientes de needs_upload
      const needsUpload = await listOutboxByStatus(['needs_upload'])
      summary.uploadedPhotos = await processNeedsUpload(
        needsUpload.filter((item) => item.tries < MAX_TRIES),
      )

      // 2) Push outbox pending / error reintentable
      const pending = (
        await listOutboxByStatus(['pending', 'error'])
      ).filter((item) => item.tries < MAX_TRIES)

      if (pending.length > 0) {
        const batch = pending.slice(0, BATCH_SIZE)
        const operations: SyncPushOperation[] = batch.map((item) => ({
          opId: item.opId,
          entity: item.entity,
          op: item.op,
          uuid: item.uuid,
          clientUpdatedAt: item.clientUpdatedAt,
          payload: item.payload,
        }))
        summary.pushed = operations.length
        const pushRes = await pushSyncBatch(operations)
        summary.applied = pushRes.applied
        summary.conflicts = pushRes.conflicts
        summary.errors = pushRes.errors
        summary.needsUpload = pushRes.needsUpload
        summary.serverTime = pushRes.serverTime
        await applyPushResults(batch, pushRes.results)
        await saveServerTime(pushRes.serverTime)
        await metaSet('lastPushApplied', pushRes.applied)
        await metaSet('lastPushConflicts', pushRes.conflicts)
        await metaSet('lastPushErrors', pushRes.errors)

        // 3) Fotos que acabaron en needs_upload en este push
        const freshNeeds = await listOutboxByStatus(['needs_upload'])
        summary.uploadedPhotos += await processNeedsUpload(
          freshNeeds.filter((item) => item.tries < MAX_TRIES),
        )
      }

      // 4) Pull deltas
      const since =
        (await metaGet<string>('lastServerTime')) || DEFAULT_SINCE
      const pull = await pullAndMerge(since, options?.obraId)
      summary.pulled = pull.pulled
      summary.serverTime = pull.serverTime

      await metaSet('lastSyncAt', nowIso())
      await metaSet('lastSyncError', null)
      return summary
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync falló'
      await metaSet('lastSyncError', message)
      throw err
    } finally {
      syncInFlight = null
    }
  })()

  return syncInFlight
}

export async function enqueueOutbox(
  item: Omit<OutboxItem, 'status' | 'tries' | 'createdAt'> & {
    status?: OutboxItem['status']
    tries?: number
    createdAt?: string
  },
): Promise<OutboxItem> {
  const row: OutboxItem = {
    ...item,
    status: item.status ?? 'pending',
    tries: item.tries ?? 0,
    createdAt: item.createdAt ?? nowIso(),
  }
  await putOutboxItem(row)
  return row
}

export async function getSyncSnapshot() {
  const [meta, pendingCount, conflicts] = await Promise.all([
    readSyncMeta(),
    countPendingOutbox(),
    listConflicts(),
  ])
  return { meta, pendingCount, conflicts }
}

export { listConflicts, acceptServerConflict, clearConflict } from '@/sync/db/entityStore'
export { countPendingOutbox }
