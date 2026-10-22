import { apiFormData, apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  ObraFulfillment,
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

export async function getObraFulfillment(
  obraId: number,
): Promise<ObraFulfillment> {
  return apiJson(
    `/api/v1/operacion/tareas/cumplimiento${buildQuery({ obraId })}`,
  )
}

export async function getTaskBoard(params: {
  obraId: number
  chapterId?: number
  dateFrom?: string
  dateTo?: string
}): Promise<TaskBoard> {
  return apiJson(`/api/v1/operacion/tareas/tablero${buildQuery(params)}`)
}

export async function listTasks(params: {
  obraId?: number
  status?: string
  chapterId?: number
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

export async function addActivityToPeriod(payload: {
  obraId: number
  templateId?: number | null
  name?: string | null
  description?: string | null
  justification: string
}): Promise<{
  task: Task
  workPlan: { id: number; name: string; status: string }
  justification: string
}> {
  return apiJson('/api/v1/operacion/tareas/agregar-al-periodo', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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

export type GalleryPhoto = {
  id: number
  fileUrl: string
  description?: string | null
  takenAt?: string | null
  createdAt?: string | null
  uploadedByName?: string | null
  taskId: number
  taskName: string
  subtaskName?: string | null
  chapterId?: number | null
  chapterName?: string | null
  budgetActivityId?: number | null
  budgetActivityName?: string | null
}

export async function listObraPhotoGallery(params: {
  obraId: number
  chapterId?: number
  budgetActivityId?: number
  taskId?: number
  page?: number
}): Promise<{
  photos: GalleryPhoto[]
  pagination: { totalItems: number; itemsPerPage: number; currentPage: number }
}> {
  return apiJson(`/api/v1/operacion/tareas/galeria${buildQuery(params)}`)
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
