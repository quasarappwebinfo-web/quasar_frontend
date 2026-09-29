export type PermissionCode =
  | 'identidad'
  | 'catalogos'
  | 'obras'
  | 'rrhh'
  | 'asistencia'
  | 'task_pool'
  | 'tareas'
  | 'planificacion'
  | 'sync'

export type AuthUser = {
  id: string | number
  username: string
  email?: string | null
  fullName?: string | null
  role?: string | null
  isSuper: number
  hasFullAccess: boolean
  permissions: string[]
}

export type LoginResponse = {
  accessToken: string
  expiresIn: number
  user?: AuthUser
  // backend puede devolver campos de usuario en la raíz
  id?: string | number
  userId?: string | number
  username?: string
  email?: string | null
  fullName?: string | null
  name?: string | null
  role?: string | null
  roleName?: string | null
  isSuper?: number
  hasFullAccess?: boolean
  permissions?: string[]
}

export type MeResponse = AuthUser
