/** Tipos del sync offline (Fase 8). */

export type SyncEntity =
  | 'task_comment'
  | 'task_delay'
  | 'task_photo'
  | 'task_status'
  | 'task_reschedule'

export type SyncOpKind = 'create' | 'update'

export type OutboxStatus =
  | 'pending'
  | 'synced'
  | 'needs_upload'
  | 'conflict'
  | 'error'

export type SyncOpResultStatus =
  | 'applied'
  | 'idempotent'
  | 'conflict'
  | 'needs_upload'
  | 'error'

export type OutboxItem = {
  opId: string
  entity: SyncEntity
  op: SyncOpKind
  uuid: string
  clientUpdatedAt: string
  payload: Record<string, unknown>
  status: OutboxStatus
  tries: number
  lastError?: string | null
  createdAt: string
  syncedAt?: string | null
  serverId?: number | null
  serverRecord?: Record<string, unknown> | null
  uploadHint?: string | null
}

export type SyncPushOperation = {
  opId: string
  entity: SyncEntity
  op: SyncOpKind
  uuid: string
  clientUpdatedAt?: string
  payload: Record<string, unknown>
}

export type SyncOpResult = {
  opId: string
  entity: string
  uuid: string
  status: SyncOpResultStatus
  serverId?: number | null
  message?: string | null
  serverRecord?: Record<string, unknown> | null
  uploadHint?: string | null
}

export type SyncPushResponse = {
  results: SyncOpResult[]
  applied: number
  conflicts: number
  errors: number
  needsUpload: number
  serverTime: string
}

export type SyncPullResponse = {
  since: string
  serverTime: string
  tasks: Record<string, unknown>[]
  comments: Record<string, unknown>[]
  delays: Record<string, unknown>[]
  photos: Record<string, unknown>[]
  reschedules: Record<string, unknown>[]
  statusHistory: Record<string, unknown>[]
}

export type SyncPhotoUploadResponse = {
  status: 'applied' | 'idempotent'
  photo: Record<string, unknown>
}

export type PhotoBlobRecord = {
  photoUuid: string
  taskUuid: string
  description?: string | null
  blob: Blob
  mimeType: string
  createdAt: string
}

export type SyncConflict = {
  opId: string
  entity: string
  uuid: string
  message?: string | null
  serverRecord?: Record<string, unknown> | null
  localPayload: Record<string, unknown>
  at: string
}

export type SyncMeta = {
  lastServerTime: string | null
  lastSyncAt: string | null
  lastSyncError: string | null
  lastPushApplied: number
  lastPushConflicts: number
  lastPushErrors: number
}

export type SyncRunSummary = {
  pushed: number
  applied: number
  conflicts: number
  errors: number
  needsUpload: number
  uploadedPhotos: number
  pulled: number
  serverTime: string | null
}
