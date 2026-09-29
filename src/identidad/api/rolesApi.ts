import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type { ActiveStatus, Pagination, Role } from '@/identidad/model/types'

type RolesResponse = {
  roles: Role[]
  pagination: Pagination
}

export async function listRoles(params: {
  page?: number
  search?: string
  activeOnly?: boolean
}): Promise<RolesResponse> {
  return apiJson(
    `/api/v1/identidad/roles${buildQuery({
      page: params.page,
      search: params.search,
      active_only: params.activeOnly,
    })}`,
  )
}

/** Select de alta/edición: nunca ofrece super_admin (solo CLI / BD). */
export async function listActiveRoles(): Promise<Role[]> {
  const data = await apiJson<{ roles: Array<{ id: number; name: string }> }>(
    '/api/v1/user/roles/active',
  )
  return data.roles
    .filter((role) => role.name !== 'super_admin')
    .map((role) => ({
      id: role.id,
      name: role.name,
      isActive: 1 as ActiveStatus,
      isSystem:
        role.name === 'admin' ||
        role.name === 'supervisor' ||
        role.name === 'maestro' ||
        role.name === 'cliente',
    }))
}

export async function createRole(name: string): Promise<Role> {
  return apiJson('/api/v1/identidad/roles', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function updateRole(
  id: number,
  payload: { name?: string; isActive?: ActiveStatus },
): Promise<Role> {
  return apiJson(`/api/v1/identidad/roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
