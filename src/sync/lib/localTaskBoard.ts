import { listLocalTaskRecords, upsertMany } from '@/sync/db/entityStore'
import { STORE } from '@/sync/db/database'
import type { Task, TaskBoard, TaskStatus } from '@/tareas/model/types'

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizeStatus(value: unknown): TaskStatus | null {
  if (typeof value !== 'string') return null
  if (
    value === 'scheduled' ||
    value === 'in_progress' ||
    value === 'completed' ||
    value === 'verified' ||
    value === 'rescheduled'
  ) {
    return value
  }
  return null
}

/** Convierte un registro IDB (camel o snake) a Task de tablero. */
export function recordToBoardTask(row: Record<string, unknown>): Task | null {
  const id = asNumber(row.id)
  const uuid = asString(row.uuid)
  const obraId = asNumber(row.obraId ?? row.obra_id)
  const name = asString(row.name)
  const status = normalizeStatus(row.status)
  const createdBy = asNumber(row.createdBy ?? row.created_by) ?? 0

  if (id == null || !uuid || obraId == null || !name || !status) return null

  const parentTaskId = asNumber(row.parentTaskId ?? row.parent_task_id)

  return {
    id,
    uuid,
    obraId,
    obraName: asString(row.obraName ?? row.obra_name),
    sourceTemplateVersionId: asNumber(
      row.sourceTemplateVersionId ?? row.source_template_version_id,
    ),
    templateCode: asString(row.templateCode ?? row.template_code),
    templateName: asString(row.templateName ?? row.template_name),
    categoryId: asNumber(row.categoryId ?? row.category_id),
    categoryName: asString(row.categoryName ?? row.category_name),
    zoneId: asNumber(row.zoneId ?? row.zone_id),
    zoneName: asString(row.zoneName ?? row.zone_name),
    budgetActivityId: asNumber(row.budgetActivityId ?? row.budget_activity_id),
    budgetActivityName: asString(
      row.budgetActivityName ?? row.budget_activity_name,
    ),
    parentTaskId,
    name,
    description: asString(row.description),
    unitId: asNumber(row.unitId ?? row.unit_id),
    unitName: asString(row.unitName ?? row.unit_name),
    unitSymbol: asString(row.unitSymbol ?? row.unit_symbol),
    plannedQuantity: (row.plannedQuantity ?? row.planned_quantity) as
      | string
      | number
      | null,
    estimatedDurationDays: (row.estimatedDurationDays ??
      row.estimated_duration_days) as string | number | null,
    approvedDurationDays: (row.approvedDurationDays ??
      row.approved_duration_days) as string | number | null,
    plannedStartDate: asString(row.plannedStartDate ?? row.planned_start_date),
    plannedEndDate: asString(row.plannedEndDate ?? row.planned_end_date),
    actualStartDate: asString(row.actualStartDate ?? row.actual_start_date),
    actualEndDate: asString(row.actualEndDate ?? row.actual_end_date),
    status,
    progressPercent: (row.progressPercent ?? row.progress_percent) as
      | string
      | number
      | null,
    weightPercent: (row.weightPercent ?? row.weight_percent) as
      | string
      | number
      | null,
    photoCount: asNumber(row.photoCount ?? row.photo_count) ?? 0,
    documentCount: asNumber(row.documentCount ?? row.document_count) ?? 0,
    attachmentCount: asNumber(row.attachmentCount ?? row.attachment_count) ?? 0,
    subtaskCount: asNumber(row.subtaskCount ?? row.subtask_count) ?? 0,
    subtasksDone: asNumber(row.subtasksDone ?? row.subtasks_done) ?? 0,
    isDelayed: Boolean(row.isDelayed ?? row.is_delayed),
    createdBy,
    createdByName: asString(row.createdByName ?? row.created_by_name),
    createdAt: asString(row.createdAt ?? row.created_at),
    updatedAt: asString(row.updatedAt ?? row.updated_at),
  }
}

function inDateRange(
  task: Task,
  dateFrom?: string,
  dateTo?: string,
): boolean {
  if (!dateFrom && !dateTo) return true
  const start = task.plannedStartDate
  if (!start) return false
  if (dateFrom && start < dateFrom) return false
  if (dateTo && start > dateTo) return false
  return true
}

export async function buildLocalTaskBoard(params: {
  obraId: number
  categoryId?: number
  dateFrom?: string
  dateTo?: string
}): Promise<TaskBoard | null> {
  const rows = await listLocalTaskRecords()
  const tasks: Task[] = []

  for (const row of rows) {
    const task = recordToBoardTask(row)
    if (!task) continue
    if (task.obraId !== params.obraId) continue
    if (task.parentTaskId != null) continue
    if (params.categoryId && task.categoryId !== params.categoryId) continue
    if (!inDateRange(task, params.dateFrom, params.dateTo)) continue
    tasks.push(task)
  }

  if (tasks.length === 0 && rows.length === 0) return null

  const columns: TaskBoard['columns'] = {
    scheduled: [],
    inProgress: [],
    completed: [],
    verified: [],
    rescheduled: [],
  }

  for (const task of tasks) {
    if (task.status === 'scheduled') columns.scheduled.push(task)
    else if (task.status === 'in_progress') columns.inProgress.push(task)
    else if (task.status === 'completed') columns.completed.push(task)
    else if (task.status === 'verified') columns.verified.push(task)
    else if (task.status === 'rescheduled') columns.rescheduled.push(task)
  }

  return {
    obraId: params.obraId,
    counts: {
      scheduled: columns.scheduled.length,
      inProgress: columns.inProgress.length,
      completed: columns.completed.length,
      verified: columns.verified.length,
      rescheduled: columns.rescheduled.length,
    },
    columns,
  }
}

/** Cachea el tablero online en IDB para lecturas offline posteriores. */
export async function cacheBoardTasks(board: TaskBoard): Promise<void> {
  const all = [
    ...board.columns.scheduled,
    ...board.columns.inProgress,
    ...board.columns.completed,
    ...board.columns.verified,
    ...board.columns.rescheduled,
  ]
  await upsertMany(
    STORE.tasks,
    all.map((task) => ({ ...task }) as unknown as Record<string, unknown>),
  )
}
