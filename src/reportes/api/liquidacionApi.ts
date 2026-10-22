import { apiFetch } from '@/auth'
import { ApiError, buildQuery } from '@/shared/api/apiJson'

export async function downloadLiquidacion(params: {
  dateFrom: string
  dateTo: string
  obraId?: number
}): Promise<void> {
  const res = await apiFetch(
    `/api/v1/rrhh/asistencia/liquidacion${buildQuery({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      obraId: params.obraId,
    })}`,
  )
  if (!res.ok) {
    let message = 'No se pudo generar la liquidación'
    try {
      const body: unknown = await res.json()
      if (body && typeof body === 'object' && 'detail' in body) {
        const detail = (body as { detail: unknown }).detail
        if (typeof detail === 'string') message = detail
      }
    } catch {
      // el cuerpo no era JSON
    }
    throw new ApiError(res.status, message)
  }

  const blob = await res.blob()
  const header = res.headers.get('Content-Disposition') || ''
  const match = /filename="([^"]+)"/.exec(header)
  const filename =
    match?.[1] || `liquidacion-${params.dateFrom}-${params.dateTo}.xlsx`
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
