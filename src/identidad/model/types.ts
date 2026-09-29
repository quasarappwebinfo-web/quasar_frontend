export type Pagination = {
  totalItems: number
  itemsPerPage: number
  currentPage: number
}

export type ActiveStatus = 1 | 2

export type Person = {
  id: number
  documentNumber: string
  name: string
  phone: string | null
  photoUrl: string | null
  birthDate: string | null
  createdAt?: string
}

export type PersonWrite = {
  documentNumber: string
  name: string
  phone?: string | null
  photoUrl?: string | null
  birthDate?: string | null
}

export type PersonUpdate = {
  name?: string
  phone?: string | null
  photoUrl?: string | null
  birthDate?: string | null
}

export type Role = {
  id: number
  name: string
  isActive: ActiveStatus
  isSystem?: boolean
}

export type PermissionCatalogItem = {
  code: string
  label: string
  description?: string
}

export type AppUser = {
  id: number
  username: string
  email: string | null
  personId: number
  personName?: string | null
  roleId: number
  roleName?: string | null
  isActive: ActiveStatus
  deactivationReason?: string | null
  isSuper?: number
  hasFullAccess?: boolean
  permissions?: string[]
}

export type UserCreate = {
  personId: number
  username: string
  password: string
  email?: string | null
  roleId: number
  permissions?: string[]
}

export type UserUpdate = {
  username?: string
  email?: string | null
  roleId?: number
  permissions?: string[]
}
