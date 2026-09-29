import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  ObraDailyAttendance,
  ObraDailyAttendanceCreate,
} from '@/obras/model/asistenciaTypes'
import type { Pagination } from '@/identidad/model/types'

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

export async function checkInObraAttendance(
  payload: ObraDailyAttendanceCreate,
): Promise<ObraDailyAttendance> {
  return apiJson('/api/v1/rrhh/asistencia', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
