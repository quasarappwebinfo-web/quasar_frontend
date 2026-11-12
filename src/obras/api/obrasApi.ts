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
  return apiJson(
    `/api/v1/obras${buildQuery({
      page: params.page,
      search: params.search,
      status: params.status,
      city: params.city,
      current_stage_id: params.currentStageId,
      active_only: params.activeOnly,
    })}`,
  )
}

export type ObraChapterZoneMark = {
  zoneId: number
  zoneName: string
  mode: 'open' | 'running' | 'completed'
  progressPercent?: number | null
}

export type ObraChapterMark = {
  chapterId: number
  chapterName: string
  zones: ObraChapterZoneMark[]
}

export async function listObraChapterMarks(
  obraId: number,
): Promise<ObraChapterMark[]> {
  const data = await apiJson<{ chapters: ObraChapterMark[] }>(
    `/api/v1/obras/${obraId}/capitulos`,
  )
  return data.chapters
}

export async function saveObraChapterMarks(
  obraId: number,
  chapters: Array<{
    chapterId: number
    zoneId: number
    mode: 'open' | 'running' | 'completed'
    progressPercent?: number
  }>,
): Promise<ObraChapterMark[]> {
  const data = await apiJson<{ chapters: ObraChapterMark[] }>(
    `/api/v1/obras/${obraId}/capitulos`,
    {
      method: 'PUT',
      body: JSON.stringify({ chapters }),
    },
  )
  return data.chapters
}

export function withoutCompletedChapters<T extends { id: number }>(
  chapters: T[],
  marks: ObraChapterMark[],
): { chapters: T[]; hidesCompleted: boolean } {
  const fullyClosed = new Set(
    marks
      .filter(
        (mark) =>
          mark.zones.length > 0 &&
          mark.zones.every((zone) => zone.mode === 'completed'),
      )
      .map((mark) => mark.chapterId),
  )
  return {
    chapters: chapters.filter((chapter) => !fullyClosed.has(chapter.id)),
    hidesCompleted: marks.some((mark) =>
      mark.zones.some((zone) => zone.mode === 'completed'),
    ),
  }
}

export function openZonesForChapter<T extends { id: number }>(
  zones: T[],
  marks: ObraChapterMark[],
  chapterId: number,
): T[] {
  const mark = marks.find((item) => item.chapterId === chapterId)
  if (!mark) return zones
  const closed = new Set(
    mark.zones
      .filter((zone) => zone.mode === 'completed')
      .map((zone) => zone.zoneId),
  )
  return zones.filter((zone) => !closed.has(zone.id))
}

export function templateZoneIsOpen(
  template: { chapterId: number | null; zoneId: number | null },
  marks: ObraChapterMark[],
): boolean {
  if (template.chapterId == null) return true
  const mark = marks.find((item) => item.chapterId === template.chapterId)
  if (!mark) return true
  const closed = mark.zones.filter((zone) => zone.mode === 'completed')
  if (closed.length === 0) return true
  if (template.zoneId == null) return false
  return !closed.some((zone) => zone.zoneId === template.zoneId)
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
