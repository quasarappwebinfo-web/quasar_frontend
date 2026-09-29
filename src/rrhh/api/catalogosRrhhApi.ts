import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  ActiveStatus,
  Pagination,
  PositionOption,
  SpecialtyOption,
} from '@/rrhh/model/types'

type PositionsResponse = {
  positions: PositionOption[]
  pagination: Pagination
}

type SpecialtiesResponse = {
  specialties: SpecialtyOption[]
  pagination: Pagination
}

/** Solo activos — para selects de trabajador / especialidad. */
export async function listActivePositions(): Promise<PositionOption[]> {
  const data = await listPositions({ page: 1, activeOnly: true })
  return data.positions
}

export async function listActiveSpecialties(params?: {
  workerPositionId?: number
}): Promise<SpecialtyOption[]> {
  const data = await listSpecialties({
    page: 1,
    activeOnly: true,
    workerPositionId: params?.workerPositionId,
  })
  return data.specialties
}

export async function listPositions(params: {
  page?: number
  search?: string
  activeOnly?: boolean
}): Promise<PositionsResponse> {
  return apiJson(`/api/v1/rrhh/cargos${buildQuery(params)}`)
}

export async function createPosition(name: string): Promise<PositionOption> {
  return apiJson('/api/v1/rrhh/cargos', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function updatePosition(
  id: number,
  payload: { name?: string; isActive?: ActiveStatus },
): Promise<PositionOption> {
  return apiJson(`/api/v1/rrhh/cargos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function listSpecialties(params: {
  page?: number
  search?: string
  activeOnly?: boolean
  workerPositionId?: number
}): Promise<SpecialtiesResponse> {
  return apiJson(`/api/v1/rrhh/especialidades${buildQuery(params)}`)
}

export async function createSpecialty(payload: {
  name: string
  workerPositionId?: number | null
}): Promise<SpecialtyOption> {
  return apiJson('/api/v1/rrhh/especialidades', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateSpecialty(
  id: number,
  payload: {
    name?: string
    workerPositionId?: number | null
    isActive?: ActiveStatus
  },
): Promise<SpecialtyOption> {
  return apiJson(`/api/v1/rrhh/especialidades/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
