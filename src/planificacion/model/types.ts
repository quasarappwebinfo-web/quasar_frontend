import type { Pagination } from '@/identidad/model/types'

export type { Pagination }

export type WorkPlanStatus =
  | 'draft'
  | 'pending_signature'
  | 'signed'
  | 'rejected'

export type SignerStatus = 'pending' | 'signed' | 'rejected'

export type SignatureType = 'acknowledgment' | 'electronic'

export type SignatureEventType =
  | 'created'
  | 'edited'
  | 'requested'
  | 'viewed'
  | 'signed'
  | 'rejected'
  | 'cancelled'

export type WorkPlan = {
  id: number
  uuid: string
  obraId: number
  obraName?: string | null
  name: string
  startDate: string
  endDate: string
  status: WorkPlanStatus
  currentVersionId?: number | null
  currentVersionNumber?: number | null
  requestedBy: number
  requestedByName?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type WorkPlanVersion = {
  id: number
  workPlanId: number
  versionNumber: number
  createdBy: number
  createdByName?: string | null
  createdAt?: string | null
  signedAt?: string | null
  isImmutable: boolean
  taskCount: number
  signerCount: number
  signedCount: number
}

export type WorkPlanTaskSnapshot = {
  id: number
  workPlanVersionId: number
  taskId: number
  taskNameSnapshot: string
  taskDescriptionSnapshot?: string | null
  quantitySnapshot?: string | number | null
  unitSnapshot?: string | null
  plannedStartDate: string
  plannedEndDate: string
  estimatedDurationDaysSnapshot?: string | number | null
  approvedDurationDaysSnapshot?: string | number | null
  createdAt?: string | null
}

export type WorkPlanSigner = {
  id: number
  workPlanVersionId: number
  userId: number
  userName?: string | null
  signatureOrder?: number | null
  status: SignerStatus
  requestedAt?: string | null
  signedAt?: string | null
  rejectedAt?: string | null
  rejectionReason?: string | null
  signatureType?: string | null
  signatureData?: string | null
}

export type WorkPlanSignatureEvent = {
  id: number
  workPlanVersionId: number
  userId?: number | null
  userName?: string | null
  eventType: SignatureEventType
  eventAt?: string | null
  details?: string | null
}

export type WorkPlanCurrentVersion = {
  version: WorkPlanVersion
  tasks: WorkPlanTaskSnapshot[]
  signers: WorkPlanSigner[]
  events: WorkPlanSignatureEvent[]
}

export type WorkPlanDetail = {
  workPlan: WorkPlan
  versions: WorkPlanVersion[]
  currentVersion: WorkPlanCurrentVersion | null
}

export type WorkPlanCreate = {
  uuid?: string | null
  obraId: number
  name: string
  startDate: string
  endDate: string
  taskIds: number[]
}

export type WorkPlanUpdate = {
  name?: string
  startDate?: string
  endDate?: string
}

export type WorkPlanAddTask = {
  taskId: number
  plannedStartDate?: string | null
  plannedEndDate?: string | null
}

export type WorkPlanAddSigner = {
  userId: number
  signatureOrder?: number | null
}

export type WorkPlanSignPayload = {
  signatureType?: SignatureType
  signatureData?: string | null
}

export type WorkPlanRejectPayload = {
  reason: string
}

export type WorkPlanNewVersion = {
  taskIds?: number[] | null
  name?: string | null
  startDate?: string | null
  endDate?: string | null
}

export type WorkPlanCompareItem = {
  taskId: number
  taskNameSnapshot: string
  quantitySnapshot?: string | number | null
  unitSnapshot?: string | null
  plannedStartDate: string
  plannedEndDate: string
  estimatedDurationDaysSnapshot?: string | number | null
  approvedDurationDaysSnapshot?: string | number | null
  currentName?: string | null
  currentStatus?: string | null
  currentPlannedStart?: string | null
  currentPlannedEnd?: string | null
  currentActualStart?: string | null
  currentActualEnd?: string | null
  currentEstimatedDurationDays?: string | number | null
  currentApprovedDurationDays?: string | number | null
  daysLostTotal?: string | number | null
  delayCount: number
  varianceNote?: string | null
}

export type WorkPlanCompare = {
  workPlanId: number
  versionId: number
  versionNumber: number
  planStatus: WorkPlanStatus
  items: WorkPlanCompareItem[]
}

export const WORK_PLAN_STATUS_LABELS: Record<WorkPlanStatus, string> = {
  draft: 'Borrador',
  pending_signature: 'Pendiente de firma',
  signed: 'Firmado',
  rejected: 'Rechazado',
}

export const SIGNER_STATUS_LABELS: Record<SignerStatus, string> = {
  pending: 'Pendiente',
  signed: 'Firmado',
  rejected: 'Rechazado',
}

export const EVENT_TYPE_LABELS: Record<SignatureEventType, string> = {
  created: 'Creación',
  edited: 'Edición',
  requested: 'Solicitud de firma',
  viewed: 'Vista registrada',
  signed: 'Firma',
  rejected: 'Rechazo',
  cancelled: 'Solicitud cancelada',
}
