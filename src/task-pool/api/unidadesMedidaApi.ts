import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  ActiveStatus,
  MeasurementUnit,
  Pagination,
} from '@/task-pool/model/types'

export async function listMeasurementUnits(params: {
  page?: number
  search?: string
  activeOnly?: boolean
}): Promise<{ measurementUnits: MeasurementUnit[]; pagination: Pagination }> {
  return apiJson(`/api/v1/catalogo/unidades-medida${buildQuery(params)}`)
}

export async function listActiveMeasurementUnits(): Promise<MeasurementUnit[]> {
  const data = await listMeasurementUnits({ page: 1, activeOnly: true })
  return data.measurementUnits
}

export async function createMeasurementUnit(payload: {
  name: string
  symbol: string
}): Promise<MeasurementUnit> {
  return apiJson('/api/v1/catalogo/unidades-medida', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateMeasurementUnit(
  id: number,
  payload: {
    name?: string
    symbol?: string
    isActive?: ActiveStatus
  },
): Promise<MeasurementUnit> {
  return apiJson(`/api/v1/catalogo/unidades-medida/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
