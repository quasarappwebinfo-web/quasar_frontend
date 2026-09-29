import { apiFormData, apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  SyncPhotoUploadResponse,
  SyncPullResponse,
  SyncPushOperation,
  SyncPushResponse,
} from '@/sync/model/types'

export async function pushSyncBatch(
  operations: SyncPushOperation[],
): Promise<SyncPushResponse> {
  return apiJson('/api/v1/sync/push', {
    method: 'POST',
    body: JSON.stringify({ operations }),
  })
}

export async function pullSyncChanges(params: {
  since: string
  obraId?: number
  limitPerEntity?: number
}): Promise<SyncPullResponse> {
  return apiJson(`/api/v1/sync/pull${buildQuery(params)}`)
}

export async function uploadSyncPhoto(params: {
  taskUuid: string
  photoUuid: string
  file: Blob
  fileName?: string
  description?: string | null
}): Promise<SyncPhotoUploadResponse> {
  const form = new FormData()
  form.append('taskUuid', params.taskUuid)
  form.append('photoUuid', params.photoUuid)
  form.append(
    'file',
    params.file,
    params.fileName || `photo-${params.photoUuid}.jpg`,
  )
  if (params.description) form.append('description', params.description)
  return apiFormData('/api/v1/sync/fotos', form, 'POST')
}
