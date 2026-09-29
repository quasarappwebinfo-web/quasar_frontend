import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type { ObraDocument, Pagination } from '@/obras/model/types'

type DocumentsResponse = {
  documents: ObraDocument[]
  pagination: Pagination
}

export async function listObraDocuments(
  obraId: number,
  params?: { page?: number; search?: string; visibleToClient?: boolean },
): Promise<DocumentsResponse> {
  return apiJson(
    `/api/v1/obras/${obraId}/documentos${buildQuery(params ?? {})}`,
  )
}

export async function createObraDocument(
  obraId: number,
  payload: {
    uuid?: string | null
    documentTypeId: number
    name: string
    description?: string | null
    fileUrl: string
    isVisibleToClient?: number
  },
): Promise<ObraDocument> {
  return apiJson(`/api/v1/obras/${obraId}/documentos`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateObraDocument(
  documentId: number,
  payload: {
    name?: string
    description?: string | null
    fileUrl?: string
    isVisibleToClient?: number
  },
): Promise<ObraDocument> {
  return apiJson(`/api/v1/obras/documentos/${documentId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
