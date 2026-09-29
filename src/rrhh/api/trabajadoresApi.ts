import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  ActiveStatus,
  Pagination,
  Worker,
  WorkerCreate,
  WorkerUpdate,
} from '@/rrhh/model/types'

type WorkersResponse = {
  workers: Worker[]
  pagination: Pagination
}

export async function listWorkers(params: {
  page?: number
  search?: string
  activeOnly?: boolean
  workerPositionId?: number
}): Promise<WorkersResponse> {
  return apiJson(`/api/v1/rrhh/trabajadores${buildQuery(params)}`)
}

export async function getWorker(id: number): Promise<Worker> {
  return apiJson(`/api/v1/rrhh/trabajadores/${id}`)
}

export async function createWorker(payload: WorkerCreate): Promise<Worker> {
  return apiJson('/api/v1/rrhh/trabajadores', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateWorker(
  id: number,
  payload: WorkerUpdate,
): Promise<Worker> {
  return apiJson(`/api/v1/rrhh/trabajadores/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function updateWorkerStatus(
  id: number,
  payload: { isActive: ActiveStatus; deactivationReason?: string },
): Promise<Worker> {
  return apiJson(`/api/v1/rrhh/trabajadores/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
