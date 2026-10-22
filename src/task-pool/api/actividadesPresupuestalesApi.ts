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
  chapterId?: number
  activeOnly?: boolean
}): Promise<{ budgetActivities: TaskBudgetActivity[]; pagination: Pagination }> {
  return apiJson(
    `/api/v1/catalogo/actividades-presupuestales${buildQuery({
      page: params.page,
      search: params.search,
      chapterId: params.chapterId,
      active_only: params.activeOnly,
    })}`,
  )
}

export async function listActiveTaskBudgetActivities(params?: {
  chapterId?: number
}): Promise<TaskBudgetActivity[]> {
  const data = await listTaskBudgetActivities({
    page: 1,
    activeOnly: true,
    chapterId: params?.chapterId,
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
