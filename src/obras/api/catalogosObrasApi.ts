import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  ActiveStatus,
  DocumentTypeOption,
  Pagination,
  SaleTypeOption,
  StageOption,
} from '@/obras/model/types'

export async function listSaleTypes(params: {
  page?: number
  search?: string
  activeOnly?: boolean
}): Promise<{ saleTypes: SaleTypeOption[]; pagination: Pagination }> {
  return apiJson(`/api/v1/obras/tipos-venta${buildQuery(params)}`)
}

export async function listActiveSaleTypes(): Promise<SaleTypeOption[]> {
  const data = await listSaleTypes({ page: 1, activeOnly: true })
  return data.saleTypes
}

export async function createSaleType(name: string): Promise<SaleTypeOption> {
  return apiJson('/api/v1/obras/tipos-venta', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function updateSaleType(
  id: number,
  payload: { name?: string; isActive?: ActiveStatus },
): Promise<SaleTypeOption> {
  return apiJson(`/api/v1/obras/tipos-venta/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function listStages(params: {
  page?: number
  search?: string
  activeOnly?: boolean
}): Promise<{ stages: StageOption[]; pagination: Pagination }> {
  return apiJson(`/api/v1/obras/etapas${buildQuery(params)}`)
}

export async function listActiveStages(): Promise<StageOption[]> {
  const data = await listStages({ page: 1, activeOnly: true })
  return [...data.stages].sort((a, b) => a.displayOrder - b.displayOrder)
}

export async function createStage(payload: {
  name: string
  description?: string | null
  displayOrder: number
}): Promise<StageOption> {
  return apiJson('/api/v1/obras/etapas', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateStage(
  id: number,
  payload: {
    name?: string
    description?: string | null
    displayOrder?: number
    isActive?: ActiveStatus
  },
): Promise<StageOption> {
  return apiJson(`/api/v1/obras/etapas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function listDocumentTypes(params: {
  page?: number
  search?: string
  activeOnly?: boolean
}): Promise<{ documentTypes: DocumentTypeOption[]; pagination: Pagination }> {
  return apiJson(`/api/v1/obras/tipos-documento${buildQuery(params)}`)
}

export async function listActiveDocumentTypes(): Promise<DocumentTypeOption[]> {
  const data = await listDocumentTypes({ page: 1, activeOnly: true })
  return data.documentTypes
}

export async function createDocumentType(payload: {
  name: string
  description?: string | null
}): Promise<DocumentTypeOption> {
  return apiJson('/api/v1/obras/tipos-documento', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateDocumentType(
  id: number,
  payload: {
    name?: string
    description?: string | null
    isActive?: ActiveStatus
  },
): Promise<DocumentTypeOption> {
  return apiJson(`/api/v1/obras/tipos-documento/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
