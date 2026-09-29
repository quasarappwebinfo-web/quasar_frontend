import type { AuthUser, LoginResponse } from '@/auth/model/types'

type LooseAuthPayload = AuthUser &
  LoginResponse & {
    userId?: string | number
    user_id?: string | number
    full_name?: string | null
    roleName?: string | null
    role_name?: string | null
    personName?: string | null
    person_name?: string | null
    name?: string | null
    is_super?: number
    has_full_access?: boolean
    permissions?: string[]
  }

function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function asPermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function normalizeAuthUser(
  data: LoginResponse | AuthUser | LooseAuthPayload,
): AuthUser {
  if ('user' in data && data.user) {
    return normalizeAuthUser(data.user)
  }

  const source = data as LooseAuthPayload
  const role =
    source.role ?? source.roleName ?? source.role_name ?? null
  const isSuper = Number(
    source.isSuper ?? source.is_super ?? (role === 'super_admin' ? 1 : 0),
  )
  const hasFullAccess =
    asBool(source.hasFullAccess ?? source.has_full_access) ||
    isSuper === 1 ||
    role === 'admin' ||
    role === 'super_admin'

  return {
    id: source.id ?? source.userId ?? source.user_id ?? source.username ?? 'unknown',
    username: source.username ?? String(source.id ?? source.userId ?? 'usuario'),
    email: source.email ?? null,
    fullName:
      source.fullName ??
      source.full_name ??
      source.personName ??
      source.person_name ??
      source.name ??
      null,
    role,
    isSuper,
    hasFullAccess,
    permissions: asPermissions(source.permissions),
  }
}
