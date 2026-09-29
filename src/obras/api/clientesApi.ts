import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type { ObraClient, ObraClientRole, Pagination } from '@/obras/model/types'

type ClientsResponse = {
  clients: ObraClient[]
  pagination: Pagination
}

export async function listObraClients(
  obraId: number,
  params?: { page?: number; currentOnly?: boolean },
): Promise<ClientsResponse> {
  return apiJson(
    `/api/v1/obras/${obraId}/clientes${buildQuery(params ?? {})}`,
  )
}

export async function addObraClient(
  obraId: number,
  payload: {
    personId: number
    role: ObraClientRole | string
    isPrimary?: number
    startDate?: string | null
  },
): Promise<ObraClient> {
  return apiJson(`/api/v1/obras/${obraId}/clientes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateObraClient(
  clientId: number,
  payload: {
    role?: string
    isPrimary?: number
    startDate?: string | null
    endDate?: string | null
  },
): Promise<ObraClient> {
  return apiJson(`/api/v1/obras/clientes/${clientId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function closeObraClient(
  clientId: number,
  endDate?: string,
): Promise<ObraClient> {
  return apiJson(
    `/api/v1/obras/clientes/${clientId}/cerrar${buildQuery({ endDate })}`,
    { method: 'PUT' },
  )
}
