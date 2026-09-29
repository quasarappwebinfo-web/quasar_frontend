import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  Pagination,
  TaskCategory,
  TaskCategoryUpdate,
  TaskCategoryWrite,
} from '@/task-pool/model/types'

export async function listTaskCategories(params: {
  page?: number
  search?: string
  activeOnly?: boolean
}): Promise<{ categories: TaskCategory[]; pagination: Pagination }> {
  return apiJson(
    `/api/v1/catalogo/categorias-tarea${buildQuery({
      page: params.page,
      search: params.search,
      active_only: params.activeOnly,
    })}`,
  )
}

export async function listActiveTaskCategories(): Promise<TaskCategory[]> {
  const data = await listTaskCategories({ page: 1, activeOnly: true })
  return data.categories
}

export async function getTaskCategory(id: number): Promise<TaskCategory> {
  return apiJson(`/api/v1/catalogo/categorias-tarea/${id}`)
}

export async function createTaskCategory(
  payload: TaskCategoryWrite,
): Promise<TaskCategory> {
  return apiJson('/api/v1/catalogo/categorias-tarea', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTaskCategory(
  id: number,
  payload: TaskCategoryUpdate,
): Promise<TaskCategory> {
  return apiJson(`/api/v1/catalogo/categorias-tarea/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
