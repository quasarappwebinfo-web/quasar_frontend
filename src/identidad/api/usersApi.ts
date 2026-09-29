import { ApiError, apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  ActiveStatus,
  AppUser,
  Pagination,
  PermissionCatalogItem,
  UserCreate,
  UserUpdate,
} from '@/identidad/model/types'

type UsersResponse = {
  users: AppUser[]
  pagination: Pagination
}

/** Fallback si el backend aún no expone el catálogo (Fase 9). */
export const FALLBACK_PERMISSION_CATALOG: PermissionCatalogItem[] = [
  { code: 'identidad', label: 'Identidad', description: 'Personas, roles y usuarios' },
  { code: 'catalogos', label: 'Catálogos', description: 'Catálogos maestros' },
  { code: 'obras', label: 'Obras', description: 'Obras / clientes / docs' },
  { code: 'rrhh', label: 'RRHH', description: 'Trabajadores y cuadrillas' },
  { code: 'asistencia', label: 'Asistencia', description: 'Asistencia diaria' },
  { code: 'task_pool', label: 'Base Datos Actividades', description: 'Task Pool / plantillas' },
  { code: 'tareas', label: 'Actividades', description: 'Actividades en obra' },
  { code: 'planificacion', label: 'Planificación', description: 'Planes y firmas' },
  { code: 'sync', label: 'Sync', description: 'Sync offline' },
]

export async function listUsers(params: {
  page?: number
  search?: string
  statusId?: ActiveStatus
}): Promise<UsersResponse> {
  return apiJson(
    `/api/v1/user/users${buildQuery({
      page: params.page,
      search: params.search,
      status_id: params.statusId,
    })}`,
  )
}

export async function getUser(id: number): Promise<AppUser> {
  return apiJson(`/api/v1/user/users/${id}`)
}

export async function listPermissionCatalog(): Promise<PermissionCatalogItem[]> {
  try {
    const data = await apiJson<{ permissions: PermissionCatalogItem[] }>(
      '/api/v1/user/permissions/catalog',
    )
    return data.permissions?.length ? data.permissions : FALLBACK_PERMISSION_CATALOG
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
      return FALLBACK_PERMISSION_CATALOG
    }
    throw err
  }
}

export async function createUser(payload: UserCreate): Promise<AppUser> {
  return apiJson('/api/v1/user/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateUser(
  id: number,
  payload: UserUpdate,
): Promise<AppUser> {
  return apiJson(`/api/v1/user/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function updateUserStatus(
  id: number,
  payload: { isActive: ActiveStatus; deactivationReason?: string },
): Promise<AppUser> {
  return apiJson(`/api/v1/user/users/${id}/update-status`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function resetUserPassword(
  id: number,
  newPassword: string,
): Promise<void> {
  await apiJson(`/api/v1/user/users/${id}/password`, {
    method: 'PUT',
    body: JSON.stringify({ newPassword }),
  })
}

export async function changeMyPassword(payload: {
  currentPassword: string
  newPassword: string
}): Promise<void> {
  await apiJson('/api/v1/user/me/password', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
