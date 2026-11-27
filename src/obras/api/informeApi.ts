import { apiFetch } from '@/auth'
import { ApiError, buildQuery } from '@/shared/api/apiJson'

async function savePdf(path: string, fallbackName: string): Promise<void> {
  const res = await apiFetch(path)
  if (!res.ok) {
    let message = 'No se pudo descargar el informe'
    try {
      const body: unknown = await res.json()
      if (
        body &&
        typeof body === 'object' &&
        'detail' in body &&
        typeof (body as { detail: unknown }).detail === 'string'
      ) {
        message = (body as { detail: string }).detail
      }
    } catch {
      // el cuerpo no es JSON
    }
    throw new ApiError(res.status, message)
  }
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = match?.[1] || fallbackName
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadObraInforme(params: {
  obraId: number
  dateFrom: string
  dateTo: string
}): Promise<void> {
  return savePdf(
    `/api/v1/obras/${params.obraId}/informe${buildQuery({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    })}`,
    `informe-${params.dateFrom}-${params.dateTo}.pdf`,
  )
}

export function downloadPlanInforme(planId: number): Promise<void> {
  return savePdf(
    `/api/v1/planificacion/planes/${planId}/informe`,
    `informe-bitacora-${planId}.pdf`,
  )
}
