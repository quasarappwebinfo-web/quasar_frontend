import type { AuthUser } from '@/auth'
import { hasPermission } from '@/auth/model/permissions'

export type SidebarItemId =
  | 'dashboard'
  | 'personal'
  | 'rrhh'
  | 'proyectos'
  | 'actividades'
  | 'reportes'

export type SidebarNavItem = {
  id: SidebarItemId
  label: string
  path: string
  /** null = visible para cualquier autenticado */
  permission: string | null
}

export const SIDEBAR_NAV: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', permission: null },
  { id: 'personal', label: 'Personal', path: '/persons', permission: 'identidad' },
  { id: 'rrhh', label: 'RRHH', path: '/rrhh', permission: 'rrhh' },
  { id: 'proyectos', label: 'Proyectos', path: '/projects', permission: 'obras' },
  { id: 'actividades', label: 'Actividades', path: '/tasks', permission: 'tareas' },
  { id: 'reportes', label: 'Reportes', path: '/reports', permission: 'obras' },
]

export function getVisibleNav(user: AuthUser | null): SidebarNavItem[] {
  return SIDEBAR_NAV.filter((item) => hasPermission(user, item.permission))
}

export function getSidebarIdFromPath(pathname: string): SidebarItemId {
  if (pathname.startsWith('/persons')) return 'personal'
  if (pathname.startsWith('/rrhh')) return 'rrhh'
  if (pathname.includes('/tareas') || pathname.startsWith('/tasks')) return 'actividades'
  if (pathname.includes('/planes') || pathname.startsWith('/dashboard/planes'))
    return 'proyectos'
  if (pathname.startsWith('/dashboard/obras')) return 'proyectos'
  if (pathname.startsWith('/projects')) return 'proyectos'
  if (pathname.startsWith('/maestros')) return 'dashboard'
  if (pathname.startsWith('/reports')) return 'reportes'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  return 'dashboard'
}

export function getUserInitials(user: AuthUser | null): string {
  const source = user?.fullName?.trim() || user?.username?.trim() || 'U'
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }

  return source.slice(0, 2).toUpperCase()
}

export function getUserDisplayName(user: AuthUser | null): string {
  return user?.fullName?.trim() || user?.username?.trim() || 'Usuario'
}

export function getUserRole(user: AuthUser | null): string {
  return user?.role?.trim() || 'Usuario'
}
