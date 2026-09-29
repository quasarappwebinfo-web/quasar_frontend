import {
  addTaskComment,
  changeTaskStatus,
  markTaskDelayed,
  uploadTaskPhoto,
} from '@/tareas/api/tareasApi'
import type { TaskComment, TaskPhoto, TaskStatus } from '@/tareas/model/types'
import { STORE } from '@/sync/db/database'
import { putPhotoBlob, upsertEntity } from '@/sync/db/entityStore'
import { enqueueOutbox, runSyncCycle } from '@/sync/lib/syncEngine'
import { createClientUuid, createOpId, nowIso } from '@/sync/lib/uuid'

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('offline')
    )
  }
  return false
}

/** Comentario: online directo; si falla red o offline → outbox. */
export async function syncAddComment(params: {
  taskId: number
  taskUuid: string
  content: string
  type?: string
}): Promise<{ offline: boolean; comment?: TaskComment }> {
  const uuid = createClientUuid()
  const clientUpdatedAt = nowIso()
  const payload = {
    taskUuid: params.taskUuid,
    taskId: params.taskId,
    type: params.type || 'comment',
    content: params.content,
  }

  if (isOnline()) {
    try {
      const comment = await addTaskComment(params.taskId, params.content)
      await upsertEntity(STORE.comments, {
        ...comment,
        uuid: comment.uuid || uuid,
      })
      return { offline: false, comment }
    } catch (err) {
      if (!isNetworkError(err)) throw err
    }
  }

  await enqueueOutbox({
    opId: createOpId(),
    entity: 'task_comment',
    op: 'create',
    uuid,
    clientUpdatedAt,
    payload,
  })
  await upsertEntity(STORE.comments, {
    uuid,
    taskId: params.taskId,
    content: params.content,
    type: payload.type,
    syncStatus: 'pending',
    createdAt: clientUpdatedAt,
  })
  return { offline: true }
}

/** Foto: online directo; offline → blob IDB + outbox sin fileUrl. */
export async function syncAddPhoto(params: {
  taskId: number
  taskUuid: string
  file: File
  description?: string
}): Promise<{ offline: boolean; photo?: TaskPhoto }> {
  const photoUuid = createClientUuid()
  const clientUpdatedAt = nowIso()

  if (isOnline()) {
    try {
      const photo = await uploadTaskPhoto(
        params.taskId,
        params.file,
        params.description,
      )
      await upsertEntity(STORE.photos, {
        ...photo,
        uuid: photo.uuid || photoUuid,
      })
      return { offline: false, photo }
    } catch (err) {
      if (!isNetworkError(err)) throw err
    }
  }

  await putPhotoBlob({
    photoUuid,
    taskUuid: params.taskUuid,
    description: params.description ?? null,
    blob: params.file,
    mimeType: params.file.type || 'image/jpeg',
    createdAt: clientUpdatedAt,
  })
  await enqueueOutbox({
    opId: createOpId(),
    entity: 'task_photo',
    op: 'create',
    uuid: photoUuid,
    clientUpdatedAt,
    payload: {
      taskUuid: params.taskUuid,
      taskId: params.taskId,
      description: params.description ?? null,
    },
  })
  await upsertEntity(STORE.photos, {
    uuid: photoUuid,
    taskId: params.taskId,
    description: params.description ?? null,
    syncStatus: 'pending',
    createdAt: clientUpdatedAt,
  })
  return { offline: true }
}

/** Retraso: online o outbox. */
export async function syncMarkDelayed(params: {
  taskId: number
  taskUuid: string
  delayed: boolean
  description?: string | null
  delayReasonId?: number | null
  daysLost?: number | null
}): Promise<{ offline: boolean }> {
  const clientUpdatedAt = nowIso()

  if (isOnline()) {
    try {
      await markTaskDelayed(params.taskId, {
        delayed: params.delayed,
        description: params.description,
        delayReasonId: params.delayReasonId,
        daysLost: params.daysLost,
      })
      return { offline: false }
    } catch (err) {
      if (!isNetworkError(err)) throw err
    }
  }

  if (!params.delayed) {
    // Cerrar retraso offline: aún no hay entidad dedicada en ola 1 para close;
    // encolamos create con endDate = hoy como aproximación vía description.
    // Mejor: solo soportar abrir retraso offline en ola 1.
    throw new Error(
      'Cerrar un retraso requiere conexión. Ábrelo offline y ciérralo al sincronizar.',
    )
  }

  const uuid = createClientUuid()
  await enqueueOutbox({
    opId: createOpId(),
    entity: 'task_delay',
    op: 'create',
    uuid,
    clientUpdatedAt,
    payload: {
      taskUuid: params.taskUuid,
      taskId: params.taskId,
      delayReasonId: params.delayReasonId ?? null,
      description: params.description ?? null,
      daysLost: params.daysLost ?? null,
      startDate: clientUpdatedAt.slice(0, 10),
    },
  })
  await upsertEntity(STORE.delays, {
    uuid,
    taskId: params.taskId,
    description: params.description ?? null,
    syncStatus: 'pending',
    createdAt: clientUpdatedAt,
  })
  return { offline: true }
}

/** Cambio de estado: uuid de la op = uuid de la actividad. */
export async function syncChangeTaskStatus(params: {
  taskId: number
  taskUuid: string
  toStatus: TaskStatus
  reason?: string | null
  force?: boolean
}): Promise<{ offline: boolean }> {
  const clientUpdatedAt = nowIso()

  if (isOnline()) {
    try {
      await changeTaskStatus(params.taskId, {
        toStatus: params.toStatus,
        reason: params.reason,
        force: params.force,
      })
      return { offline: false }
    } catch (err) {
      if (!isNetworkError(err)) throw err
    }
  }

  await enqueueOutbox({
    opId: createOpId(),
    entity: 'task_status',
    op: 'update',
    uuid: params.taskUuid,
    clientUpdatedAt,
    payload: {
      toStatus: params.toStatus,
      reason: params.reason ?? null,
      force: params.force ?? false,
    },
  })
  await upsertEntity(STORE.tasks, {
    uuid: params.taskUuid,
    id: params.taskId,
    status: params.toStatus,
    syncStatus: 'pending',
    updatedAt: clientUpdatedAt,
  })
  return { offline: true }
}

export async function syncRescheduleTask(params: {
  taskId: number
  taskUuid: string
  newStartDate?: string | null
  newEndDate?: string | null
  reasonId?: number | null
  reason?: string | null
}): Promise<{ offline: boolean }> {
  const uuid = createClientUuid()
  const clientUpdatedAt = nowIso()
  await enqueueOutbox({
    opId: createOpId(),
    entity: 'task_reschedule',
    op: 'create',
    uuid,
    clientUpdatedAt,
    payload: {
      taskUuid: params.taskUuid,
      taskId: params.taskId,
      newStartDate: params.newStartDate ?? null,
      newEndDate: params.newEndDate ?? null,
      reasonId: params.reasonId ?? null,
      reason: params.reason ?? null,
    },
  })
  if (isOnline()) {
    void runSyncCycle().catch(() => undefined)
  }
  return { offline: !isOnline() }
}
