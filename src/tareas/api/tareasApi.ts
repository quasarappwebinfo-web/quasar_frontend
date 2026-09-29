import { apiFormData, apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  Task,
  TaskBoard,
  TaskComment,
  TaskCreateFromTemplate,
  TaskCreateManual,
  TaskDetail,
  TaskDocument,
  TaskMarkDelayed,
  TaskPhoto,
  TaskStatusChange,
  TaskStatusChangeResult,
  TaskUpdate,
} from '@/tareas/model/types'

export async function getTaskBoard(params: {
  obraId: number
  categoryId?: number
  dateFrom?: string
  dateTo?: string
}): Promise<TaskBoard> {
  return apiJson(`/api/v1/operacion/tareas/tablero${buildQuery(params)}`)
}

export async function listTasks(params: {
  obraId?: number
  status?: string
  categoryId?: number
  search?: string
  dateFrom?: string
  dateTo?: string
  parentOnly?: boolean
  parentTaskId?: number
  page?: number
}): Promise<{
  tasks: Task[]
  pagination: { totalItems: number; itemsPerPage: number; currentPage: number }
}> {
  return apiJson(`/api/v1/operacion/tareas${buildQuery(params)}`)
}

export async function createTaskFromTemplate(
  payload: TaskCreateFromTemplate,
): Promise<Task> {
  return apiJson('/api/v1/operacion/tareas/desde-plantilla', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createTask(payload: TaskCreateManual): Promise<Task> {
  return apiJson('/api/v1/operacion/tareas', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getTaskDetail(taskId: number): Promise<TaskDetail> {
  return apiJson(`/api/v1/operacion/tareas/${taskId}`)
}

/** @deprecated Prefer getTaskDetail */
export async function getTask(taskId: number): Promise<TaskDetail> {
  return getTaskDetail(taskId)
}

export async function updateTask(
  taskId: number,
  payload: TaskUpdate,
): Promise<Task> {
  return apiJson(`/api/v1/operacion/tareas/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function changeTaskStatus(
  taskId: number,
  payload: TaskStatusChange,
): Promise<TaskStatusChangeResult | Task> {
  return apiJson(`/api/v1/operacion/tareas/${taskId}/estado`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function toggleSubtask(
  taskId: number,
  subtaskId: number,
  completed: boolean,
): Promise<Task> {
  return apiJson(
    `/api/v1/operacion/tareas/${taskId}/subtareas/${subtaskId}/toggle${buildQuery({
      completed,
    })}`,
    { method: 'POST' },
  )
}

export async function markTaskDelayed(
  taskId: number,
  payload: TaskMarkDelayed,
): Promise<{ task: Task; delays: unknown[] }> {
  return apiJson(`/api/v1/operacion/tareas/${taskId}/marcar-retraso`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function addTaskComment(
  taskId: number,
  content: string,
): Promise<TaskComment> {
  return apiJson(`/api/v1/operacion/tareas/${taskId}/comentarios`, {
    method: 'POST',
    body: JSON.stringify({ type: 'comment', content }),
  })
}

export async function uploadTaskPhoto(
  taskId: number,
  file: File,
  description?: string,
): Promise<TaskPhoto> {
  const form = new FormData()
  form.append('file', file)
  if (description) form.append('description', description)
  return apiFormData(`/api/v1/operacion/tareas/${taskId}/fotos`, form, 'POST')
}

export async function uploadTaskDocument(
  taskId: number,
  file: File,
  description?: string,
): Promise<TaskDocument> {
  const form = new FormData()
  form.append('file', file)
  if (description) form.append('description', description)
  return apiFormData(
    `/api/v1/operacion/tareas/${taskId}/documentos`,
    form,
    'POST',
  )
}
