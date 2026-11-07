import { apiFormData, apiJson, buildQuery } from '@/shared/api/apiJson'
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
    `/api/v1/obras/${obraId}/documentos${buildQuery({
      page: params?.page,
      search: params?.search,
      visible_to_client: params?.visibleToClient,
    })}`,
  )
}

export async function uploadObraDocuments(
  obraId: number,
  items: { file: File; name: string; description: string; visible: boolean }[],
): Promise<{ documents: ObraDocument[] }> {
  const form = new FormData()
  for (const item of items) {
    form.append('files', item.file)
    form.append('names', item.name.trim())
    form.append('descriptions', item.description.trim())
    form.append('visibles', item.visible ? '1' : '0')
  }
  return apiFormData(`/api/v1/obras/${obraId}/documentos/archivos`, form, 'POST')
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
