import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type { Pagination, WorkerAssignment } from '@/rrhh/model/types'

type AssignmentsResponse = {
  assignments: WorkerAssignment[]
  pagination: Pagination
}

export async function listAssignments(params: {
  page?: number
  workerId?: number
  obraId?: number
  currentOnly?: boolean
}): Promise<AssignmentsResponse> {
  return apiJson(`/api/v1/rrhh/asignaciones${buildQuery(params)}`)
}

export async function createAssignment(payload: {
  workerId: number
  obraId: number
  startDate: string
  endDate?: string | null
}): Promise<WorkerAssignment> {
  return apiJson('/api/v1/rrhh/asignaciones', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function closeAssignment(
  id: number,
  payload?: { endDate?: string },
): Promise<WorkerAssignment> {
  return apiJson(`/api/v1/rrhh/asignaciones/${id}/cerrar`, {
    method: 'PUT',
    body: JSON.stringify(payload ?? {}),
  })
}
