import type { Pagination } from '@/identidad/model/types'

export type { Pagination }

export type TaskStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'verified'
  | 'rescheduled'

export type TaskAssignee = {
  workerId?: number | null
  workerName?: string | null
  initials?: string | null
  positionName?: string | null
  crewId?: number | null
  crewName?: string | null
}

export type Task = {
  id: number
  uuid: string
  obraId: number
  obraName?: string | null
  sourceTemplateVersionId?: number | null
  templateCode?: string | null
  templateName?: string | null
  categoryId?: number | null
  categoryName?: string | null
  zoneId?: number | null
  zoneName?: string | null
  budgetActivityId?: number | null
  budgetActivityName?: string | null
  parentTaskId?: number | null
  name: string
  description?: string | null
  unitId?: number | null
  unitName?: string | null
  unitSymbol?: string | null
  plannedQuantity?: string | number | null
  templateBaseQuantity?: string | number | null
  templateBaseDurationDays?: string | number | null
  estimatedDurationDays?: string | number | null
  approvedDurationDays?: string | number | null
  plannedStartDate?: string | null
  plannedEndDate?: string | null
  actualStartDate?: string | null
  actualEndDate?: string | null
  status: TaskStatus
  progressPercent?: string | number | null
  weightPercent?: string | number | null
  budgetWeightPercent?: string | number | null
  photoCount: number
  documentCount?: number
  attachmentCount?: number
  subtaskCount: number
  subtasksDone: number
  isDelayed?: boolean
  primaryAssignee?: TaskAssignee | null
  createdBy: number
  createdByName?: string | null
  createdAt?: string | null
  updatedBy?: number | null
  updatedByName?: string | null
  updatedAt?: string | null
}

export type TaskComment = {
  id: number
  uuid: string
  taskId: number
  userId: number
  userName?: string | null
  type: string
  content: string
  createdAt?: string | null
  updatedAt?: string | null
}

export type TaskPhoto = {
  id: number
  uuid: string
  taskId: number
  fileUrl: string
  description?: string | null
  takenAt?: string | null
  uploadedBy: number
  uploadedByName?: string | null
  createdAt?: string | null
}

export type TaskDocument = {
  id: number
  uuid: string
  taskId: number
  fileUrl: string
  fileName?: string | null
  description?: string | null
  uploadedBy: number
  uploadedByName?: string | null
  createdAt?: string | null
}

export type TaskDelayEvent = {
  id: number
  taskId: number
  delayReasonId?: number | null
  delayReasonName?: string | null
  description?: string | null
  daysLost?: string | number | null
  startDate?: string | null
  endDate?: string | null
  createdBy?: number | null
  createdAt?: string | null
}

export type TaskActivityEvent = {
  eventType: string
  at: string
  userId?: number | null
  userName?: string | null
  summary: string
  detail?: string | null
  refId?: number | null
}

export type TaskDetail = {
  task: Task
  subtasks: Task[]
  dependencies: unknown[]
  overrides: unknown[]
  assignments: {
    workers: unknown[]
    crews: unknown[]
  }
  statusHistory: unknown[]
  reschedules: unknown[]
  delays: TaskDelayEvent[]
  comments: TaskComment[]
  photos: TaskPhoto[]
  documents: TaskDocument[]
  activity: TaskActivityEvent[]
}

export type TaskBoard = {
  obraId: number
  counts: {
    scheduled: number
    inProgress: number
    completed: number
    verified: number
    rescheduled: number
  }
  columns: {
    scheduled: Task[]
    inProgress: Task[]
    completed: Task[]
    verified: Task[]
    rescheduled: Task[]
  }
}

export type TaskCreateFromTemplate = {
  uuid?: string
  obraId: number
  sourceTemplateVersionId: number
  plannedQuantity: number
  approvedDurationDays?: number | null
  plannedStartDate?: string | null
  plannedEndDate?: string | null
  name?: string | null
  description?: string | null
  copySubtasks?: boolean
  instantiateDependencies?: boolean
}

export type TaskCreateManual = {
  uuid?: string
  obraId: number
  parentTaskId?: number | null
  name: string
  description?: string | null
  plannedStartDate?: string | null
  plannedEndDate?: string | null
  weightPercent?: number | null
}

export type TaskUpdate = {
  name?: string
  description?: string | null
  plannedStartDate?: string | null
  plannedEndDate?: string | null
  approvedDurationDays?: number | null
}

export type TaskStatusChange = {
  toStatus: TaskStatus
  reason?: string | null
  force?: boolean
}

export type TaskMarkDelayed = {
  delayed: boolean
  delayReasonId?: number | null
  description?: string | null
  daysLost?: number | null
}

export type BlockingDependency = {
  dependencyId: number
  dependsOnTaskId: number
  dependsOnTaskName?: string | null
  dependsOnStatus?: string | null
  dependencyType: string
  blocksStart: number
  message: string
}

export type TaskStatusChangeResult = {
  task: Task
  blocked?: boolean
  blockingDependencies?: BlockingDependency[]
  forced?: boolean
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  scheduled: 'Programadas',
  in_progress: 'En progreso',
  completed: 'Completadas',
  verified: 'Verificadas',
  rescheduled: 'Re-programadas',
}

export const TASK_STATUS_BADGE: Record<TaskStatus, string> = {
  scheduled: 'PROGRAMADA',
  in_progress: 'EN PROGRESO',
  completed: 'COMPLETADA',
  verified: 'VERIFICADA',
  rescheduled: 'RE-PROGRAMADA',
}

export const BOARD_COLUMNS: {
  key: keyof TaskBoard['columns']
  status: TaskStatus
  label: string
  countKey: keyof TaskBoard['counts']
}[] = [
  { key: 'scheduled', status: 'scheduled', label: 'Programadas', countKey: 'scheduled' },
  { key: 'inProgress', status: 'in_progress', label: 'En progreso', countKey: 'inProgress' },
  { key: 'completed', status: 'completed', label: 'Completadas', countKey: 'completed' },
  { key: 'verified', status: 'verified', label: 'Verificadas', countKey: 'verified' },
  {
    key: 'rescheduled',
    status: 'rescheduled',
    label: 'Re-programadas',
    countKey: 'rescheduled',
  },
]

export const ALLOWED_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  scheduled: ['in_progress'],
  in_progress: ['completed', 'scheduled'],
  completed: ['verified', 'in_progress'],
  verified: [],
  rescheduled: ['scheduled', 'in_progress'],
}
