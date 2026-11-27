import { apiFetch } from '@/auth'
import { ApiError, apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  ObraDailyAttendance,
  ObraDailyAttendanceCreate,
} from '@/obras/model/asistenciaTypes'
import type { Pagination } from '@/identidad/model/types'

export async function listAttendancePresence(date?: string): Promise<{
  workDate: string
  total: number
  counts: { obraId: number; count: number }[]
}> {
  return apiJson(
    `/api/v1/rrhh/asistencia/en-sitio${buildQuery({ date })}`,
  )
}

export async function listObraAttendance(params: {
  obraId: number
  date: string
  currentOnly?: boolean
  page?: number
}): Promise<{ attendance: ObraDailyAttendance[]; pagination: Pagination }> {
  return apiJson(
    `/api/v1/rrhh/asistencia${buildQuery({
      obraId: params.obraId,
      date: params.date,
      currentOnly: params.currentOnly ?? true,
      page: params.page,
    })}`,
  )
}

export async function downloadAttendanceReport(params: {
  obraId: number
  dateFrom: string
  dateTo: string
}): Promise<void> {
  const res = await apiFetch(
    `/api/v1/rrhh/asistencia/liquidacion${buildQuery({
      obraId: params.obraId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    })}`,
  )
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
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `llegadas-${params.dateFrom}-${params.dateTo}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}

export async function removeObraAttendance(params: {
  attendanceId: number
  reason: string
}): Promise<void> {
  await apiJson(`/api/v1/rrhh/asistencia/${params.attendanceId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason: params.reason }),
  })
}

export async function checkInObraAttendance(
  payload: ObraDailyAttendanceCreate,
): Promise<ObraDailyAttendance> {
  return apiJson('/api/v1/rrhh/asistencia', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
