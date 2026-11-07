import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  Pagination,
  TaskZone,
  TaskZoneUpdate,
  TaskZoneWrite,
} from '@/task-pool/model/types'

export async function listTaskZones(params: {
  page?: number
  search?: string
  activeOnly?: boolean
}): Promise<{ zones: TaskZone[]; pagination: Pagination }> {
  return apiJson(
    `/api/v1/catalogo/zonas-tarea${buildQuery({
      page: params.page,
      search: params.search,
      active_only: params.activeOnly,
    })}`,
  )
}

export async function listActiveTaskZones(): Promise<TaskZone[]> {
  const all: TaskZone[] = []
  let page = 1
  let total = 0
  do {
    const data = await listTaskZones({ page, activeOnly: true })
    all.push(...data.zones)
    total = data.pagination.totalItems
    page += 1
  } while (all.length < total && page <= 40)
  return all
}

export async function createTaskZone(
  payload: TaskZoneWrite,
): Promise<TaskZone> {
  return apiJson('/api/v1/catalogo/zonas-tarea', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTaskZone(
  id: number,
  payload: TaskZoneUpdate,
): Promise<TaskZone> {
  return apiJson(`/api/v1/catalogo/zonas-tarea/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
