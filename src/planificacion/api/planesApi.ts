import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  Pagination,
  WorkPlan,
  WorkPlanAddTask,
  WorkPlanCompare,
  WorkPlanCreate,
  WorkPlanDetail,
  WorkPlanNewVersion,
  WorkPlanStatus,
  WorkPlanTaskSnapshot,
  WorkPlanUpdate,
  UnfinishedPlanActivity,
} from '@/planificacion/model/types'

export async function listWorkPlans(params: {
  page?: number
  obraId?: number
  status?: WorkPlanStatus
  search?: string
}): Promise<{ workPlans: WorkPlan[]; pagination: Pagination }> {
  return apiJson(
    `/api/v1/planificacion/planes${buildQuery({
      page: params.page,
      obraId: params.obraId,
      status: params.status,
      search: params.search,
    })}`,
  )
}

export async function listUnfinishedPlanActivities(
  obraId: number,
): Promise<{ tasks: UnfinishedPlanActivity[] }> {
  return apiJson(
    `/api/v1/planificacion/planes/pendientes${buildQuery({ obraId })}`,
  )
}

export async function getWorkPlan(planId: number): Promise<WorkPlanDetail> {
  return apiJson(`/api/v1/planificacion/planes/${planId}`)
}

export async function createWorkPlan(payload: WorkPlanCreate): Promise<WorkPlan> {
  return apiJson('/api/v1/planificacion/planes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateWorkPlan(
  planId: number,
  payload: WorkPlanUpdate,
): Promise<WorkPlan> {
  return apiJson(`/api/v1/planificacion/planes/${planId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function compareWorkPlan(
  planId: number,
  versionId?: number,
): Promise<WorkPlanCompare> {
  return apiJson(
    `/api/v1/planificacion/planes/${planId}/comparar${buildQuery({
      versionId,
    })}`,
  )
}

export async function createWorkPlanVersion(
  planId: number,
  payload: WorkPlanNewVersion = {},
): Promise<WorkPlan> {
  return apiJson(`/api/v1/planificacion/planes/${planId}/nueva-version`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function addWorkPlanTask(
  versionId: number,
  payload: WorkPlanAddTask,
): Promise<WorkPlanTaskSnapshot> {
  return apiJson(`/api/v1/planificacion/planes/versiones/${versionId}/tareas`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function removeWorkPlanSnapshot(snapshotId: number): Promise<void> {
  return apiJson(`/api/v1/planificacion/planes/snapshots/${snapshotId}`, {
    method: 'DELETE',
  })
}
