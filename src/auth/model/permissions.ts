import type { AuthUser } from '@/auth/model/types'

export function hasPermission(
  user: AuthUser | null | undefined,
  code: string | null | undefined,
): boolean {
  if (!user) return false
  if (!code) return true
  if (user.hasFullAccess || user.isSuper === 1) return true
  return user.permissions.includes(code)
}

export function hasAnyPermission(
  user: AuthUser | null | undefined,
  codes: Array<string | null | undefined>,
): boolean {
  if (!user) return false
  if (user.hasFullAccess || user.isSuper === 1) return true
  return codes.some((code) => code && user.permissions.includes(code))
}

export function isSuperUser(user: {
  isSuper?: number | null
  roleName?: string | null
  role?: string | null
} | null | undefined): boolean {
  if (!user) return false
  if (user.isSuper === 1) return true
  const role = user.roleName ?? user.role ?? ''
  return role === 'super_admin'
}

export function isAdminUser(user: {
  roleName?: string | null
  role?: string | null
} | null | undefined): boolean {
  if (!user) return false
  const role = user.roleName ?? user.role ?? ''
  return role === 'admin'
}

/** ¿El actor puede editar / desactivar / reset password del target? */
export function canManageUser(
  actor: AuthUser | null | undefined,
  target: {
    isSuper?: number | null
    roleName?: string | null
    hasFullAccess?: boolean
  },
): boolean {
  if (!actor) return false
  if (isSuperUser(target)) return false
  if (isAdminUser(target) && !isSuperUser(actor)) return false
  return hasPermission(actor, 'identidad')
}

export function roleHasFullAccess(roleName: string | null | undefined): boolean {
  return roleName === 'admin' || roleName === 'super_admin'
}
