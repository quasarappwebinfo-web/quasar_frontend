import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  Pagination,
  WorkPlan,
  WorkPlanAddSigner,
  WorkPlanAddTask,
  WorkPlanCompare,
  WorkPlanCreate,
  WorkPlanDetail,
  WorkPlanNewVersion,
  WorkPlanRejectPayload,
  WorkPlanSignPayload,
  WorkPlanSigner,
  WorkPlanStatus,
  WorkPlanTaskSnapshot,
  WorkPlanUpdate,
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

export async function requestWorkPlanSignature(planId: number): Promise<WorkPlan> {
  return apiJson(`/api/v1/planificacion/planes/${planId}/solicitar-firma`, {
    method: 'POST',
  })
}

export async function cancelWorkPlanSignature(planId: number): Promise<WorkPlan> {
  return apiJson(`/api/v1/planificacion/planes/${planId}/cancelar-firma`, {
    method: 'POST',
  })
}

export async function registerWorkPlanView(
  planId: number,
): Promise<{ ok: boolean }> {
  return apiJson(`/api/v1/planificacion/planes/${planId}/vista`, {
    method: 'POST',
  })
}

export async function signWorkPlan(
  planId: number,
  payload: WorkPlanSignPayload,
): Promise<{ workPlan: WorkPlan; signer: WorkPlanSigner; fullySigned: boolean }> {
  return apiJson(`/api/v1/planificacion/planes/${planId}/firmar`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function rejectWorkPlan(
  planId: number,
  payload: WorkPlanRejectPayload,
): Promise<{ workPlan: WorkPlan; signer: WorkPlanSigner }> {
  return apiJson(`/api/v1/planificacion/planes/${planId}/rechazar`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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

export async function addWorkPlanSigner(
  versionId: number,
  payload: WorkPlanAddSigner,
): Promise<WorkPlanSigner> {
  return apiJson(`/api/v1/planificacion/planes/versiones/${versionId}/firmantes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function removeWorkPlanSigner(signerId: number): Promise<void> {
  return apiJson(`/api/v1/planificacion/planes/firmantes/${signerId}`, {
    method: 'DELETE',
  })
}
