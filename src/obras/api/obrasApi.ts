import { apiFormData, apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  Obra,
  ObraCreate,
  ObraStageChange,
  ObraStageHistory,
  ObraUpdate,
  Pagination,
} from '@/obras/model/types'

type ObrasResponse = {
  obras: Obra[]
  pagination: Pagination
}

type HistoryResponse = {
  history: ObraStageHistory[]
  pagination: Pagination
}

export async function listObras(params: {
  page?: number
  search?: string
  status?: string
  city?: string
  currentStageId?: number
  activeOnly?: boolean
}): Promise<ObrasResponse> {
  return apiJson(`/api/v1/obras${buildQuery(params)}`)
}

export async function getObra(id: number): Promise<Obra> {
  return apiJson(`/api/v1/obras/${id}`)
}

export async function createObra(payload: ObraCreate): Promise<Obra> {
  return apiJson('/api/v1/obras', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateObra(id: number, payload: ObraUpdate): Promise<Obra> {
  return apiJson(`/api/v1/obras/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function uploadObraCover(id: number, file: File): Promise<Obra> {
  const form = new FormData()
  form.append('file', file)
  return apiFormData(`/api/v1/obras/${id}/imagen-principal`, form, 'PUT')
}

export async function deleteObraCover(id: number): Promise<Obra> {
  return apiJson(`/api/v1/obras/${id}/imagen-principal`, {
    method: 'DELETE',
  })
}

export async function changeObraStage(
  id: number,
  payload: ObraStageChange,
): Promise<Obra> {
  return apiJson(`/api/v1/obras/${id}/etapa`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function listObraStageHistory(
  id: number,
  page = 1,
): Promise<HistoryResponse> {
  return apiJson(`/api/v1/obras/${id}/etapas-historial${buildQuery({ page })}`)
}
