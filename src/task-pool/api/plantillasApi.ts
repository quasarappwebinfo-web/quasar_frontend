import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  Pagination,
  TaskTemplate,
  TaskTemplateUpdate,
  TaskTemplateWrite,
} from '@/task-pool/model/types'

export async function listTaskTemplates(params: {
  page?: number
  search?: string
  categoryId?: number
  zoneId?: number
  budgetActivityId?: number
  activeOnly?: boolean
}): Promise<{ templates: TaskTemplate[]; pagination: Pagination }> {
  return apiJson(
    `/api/v1/catalogo/plantillas${buildQuery({
      page: params.page,
      search: params.search,
      category_id: params.categoryId,
      zone_id: params.zoneId,
      budget_activity_id: params.budgetActivityId,
      active_only: params.activeOnly,
    })}`,
  )
}

export async function listActiveTaskTemplates(params?: {
  categoryId?: number
}): Promise<TaskTemplate[]> {
  const data = await listTaskTemplates({
    page: 1,
    activeOnly: true,
    categoryId: params?.categoryId,
  })
  return data.templates
}

export async function getTaskTemplate(id: number): Promise<TaskTemplate> {
  return apiJson(`/api/v1/catalogo/plantillas/${id}`)
}

export async function createTaskTemplate(
  payload: TaskTemplateWrite,
): Promise<TaskTemplate> {
  return apiJson('/api/v1/catalogo/plantillas', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTaskTemplate(
  id: number,
  payload: TaskTemplateUpdate,
): Promise<TaskTemplate> {
  return apiJson(`/api/v1/catalogo/plantillas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
