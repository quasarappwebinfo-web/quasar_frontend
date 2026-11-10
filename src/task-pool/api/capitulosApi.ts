import { sortChapters } from '@/task-pool/lib/chapterOrder'
import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  Pagination,
  TaskChapter,
  TaskChapterUpdate,
  TaskChapterWrite,
} from '@/task-pool/model/types'

export async function listTaskChapters(params: {
  page?: number
  search?: string
  activeOnly?: boolean
}): Promise<{ chapters: TaskChapter[]; pagination: Pagination }> {
  return apiJson(
    `/api/v1/catalogo/capitulos-tarea${buildQuery({
      page: params.page,
      search: params.search,
      active_only: params.activeOnly,
    })}`,
  )
}

export async function listActiveTaskChapters(): Promise<TaskChapter[]> {
  const all: TaskChapter[] = []
  let page = 1
  let total = 0
  do {
    const data = await listTaskChapters({ page, activeOnly: true })
    all.push(...data.chapters)
    total = data.pagination.totalItems
    page += 1
  } while (all.length < total && page <= 40)
  return sortChapters(all)
}

export async function getTaskChapter(id: number): Promise<TaskChapter> {
  return apiJson(`/api/v1/catalogo/capitulos-tarea/${id}`)
}

export async function createTaskChapter(
  payload: TaskChapterWrite,
): Promise<TaskChapter> {
  return apiJson('/api/v1/catalogo/capitulos-tarea', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTaskChapter(
  id: number,
  payload: TaskChapterUpdate,
): Promise<TaskChapter> {
  return apiJson(`/api/v1/catalogo/capitulos-tarea/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
