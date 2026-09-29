import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  Pagination,
  TaskBudgetActivity,
  TaskBudgetActivityUpdate,
  TaskBudgetActivityWrite,
} from '@/task-pool/model/types'

export async function listTaskBudgetActivities(params: {
  page?: number
  search?: string
  categoryId?: number
  activeOnly?: boolean
}): Promise<{ budgetActivities: TaskBudgetActivity[]; pagination: Pagination }> {
  return apiJson(
    `/api/v1/catalogo/actividades-presupuestales${buildQuery({
      page: params.page,
      search: params.search,
      category_id: params.categoryId,
      active_only: params.activeOnly,
    })}`,
  )
}

export async function listActiveTaskBudgetActivities(params?: {
  categoryId?: number
}): Promise<TaskBudgetActivity[]> {
  const data = await listTaskBudgetActivities({
    page: 1,
    activeOnly: true,
    categoryId: params?.categoryId,
  })
  return data.budgetActivities
}

export async function createTaskBudgetActivity(
  payload: TaskBudgetActivityWrite,
): Promise<TaskBudgetActivity> {
  return apiJson('/api/v1/catalogo/actividades-presupuestales', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTaskBudgetActivity(
  id: number,
  payload: TaskBudgetActivityUpdate,
): Promise<TaskBudgetActivity> {
  return apiJson(`/api/v1/catalogo/actividades-presupuestales/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
