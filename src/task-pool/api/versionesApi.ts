import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  DependencyType,
  Pagination,
  RecommendationResult,
  TaskTemplateVersion,
  TaskTemplateVersionUpdate,
  TaskTemplateVersionWrite,
  VersionDependency,
  VersionDetail,
  VersionMeasurement,
  VersionPosition,
  VersionStatus,
  VersionSubtask,
} from '@/task-pool/model/types'

export async function listTaskTemplateVersions(params: {
  page?: number
  templateId?: number
  status?: VersionStatus
}): Promise<{ versions: TaskTemplateVersion[]; pagination: Pagination }> {
  // Backend Query params: template_id + status (sin alias camelCase)
  return apiJson(
    `/api/v1/catalogo/plantillas-versiones${buildQuery({
      page: params.page,
      template_id: params.templateId,
      status: params.status,
    })}`,
  )
}

export async function getTaskTemplateVersion(
  id: number,
): Promise<VersionDetail> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/${id}`)
}

export async function createTaskTemplateVersion(
  payload: TaskTemplateVersionWrite,
): Promise<TaskTemplateVersion> {
  return apiJson('/api/v1/catalogo/plantillas-versiones', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTaskTemplateVersion(
  id: number,
  payload: TaskTemplateVersionUpdate,
): Promise<TaskTemplateVersion> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function publishTaskTemplateVersion(
  id: number,
): Promise<TaskTemplateVersion> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/${id}/publicar`, {
    method: 'POST',
  })
}

export async function archiveTaskTemplateVersion(
  id: number,
): Promise<TaskTemplateVersion> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/${id}/archivar`, {
    method: 'POST',
  })
}

export async function recommendFromVersion(
  id: number,
  obraQuantity: number,
  targetDurationDays?: number,
): Promise<RecommendationResult> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/${id}/recomendar`, {
    method: 'POST',
    body: JSON.stringify({
      obraQuantity,
      ...(targetDurationDays != null
        ? { targetDurationDays }
        : {}),
    }),
  })
}

export async function addVersionMeasurement(
  versionId: number,
  payload: { unitId: number; isPrimary?: 0 | 1 },
): Promise<VersionMeasurement> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/${versionId}/unidades`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteVersionMeasurement(itemId: number): Promise<void> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/unidades/${itemId}`, {
    method: 'DELETE',
  })
}

export async function addVersionPosition(
  versionId: number,
  payload: {
    workerPositionId: number
    specialtyId?: number | null
    quantity: number
    isRequired?: 0 | 1
  },
): Promise<VersionPosition> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/${versionId}/cargos`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateVersionPosition(
  itemId: number,
  payload: {
    quantity?: number
    isRequired?: 0 | 1
  },
): Promise<VersionPosition> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/cargos/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteVersionPosition(itemId: number): Promise<void> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/cargos/${itemId}`, {
    method: 'DELETE',
  })
}

export async function addVersionSubtask(
  versionId: number,
  payload: {
    name: string
    description?: string | null
    displayOrder?: number
    isRequired?: 0 | 1
    weightPercent: number
  },
): Promise<VersionSubtask> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/${versionId}/subtareas`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateVersionSubtask(
  itemId: number,
  payload: {
    name?: string
    description?: string | null
    displayOrder?: number
    isRequired?: 0 | 1
    weightPercent?: number
  },
): Promise<VersionSubtask> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/subtareas/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteVersionSubtask(itemId: number): Promise<void> {
  return apiJson(`/api/v1/catalogo/plantillas-versiones/subtareas/${itemId}`, {
    method: 'DELETE',
  })
}

export async function addVersionDependency(
  versionId: number,
  payload: {
    dependsOnTemplateId: number
    dependencyType?: DependencyType
    isRequired?: 0 | 1
    blocksStart?: 0 | 1
    description?: string | null
  },
): Promise<VersionDependency> {
  return apiJson(
    `/api/v1/catalogo/plantillas-versiones/${versionId}/dependencias`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export async function deleteVersionDependency(itemId: number): Promise<void> {
  return apiJson(
    `/api/v1/catalogo/plantillas-versiones/dependencias/${itemId}`,
    { method: 'DELETE' },
  )
}
