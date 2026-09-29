import type { ActiveStatus, Pagination } from '@/identidad/model/types'

export type ObraStatus =
  | 'planning'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'cancelled'

export type ObraClientRole = 'comprador' | 'propietario' | 'contacto'

export type Obra = {
  id: number
  name: string
  code: string | null
  saleTypeId: number
  saleTypeName: string | null
  address: string | null
  city: string | null
  neighborhood: string | null
  startDate: string | null
  estimatedEndDate: string | null
  actualEndDate: string | null
  currentStageId: number | null
  currentStageName: string | null
  status: ObraStatus | string
  isActive: ActiveStatus
  coverImageUrl?: string | null
  createdAt?: string | null
}

export type ObraCreate = {
  name: string
  code?: string | null
  saleTypeId: number
  address?: string | null
  city?: string | null
  neighborhood?: string | null
  startDate?: string | null
  estimatedEndDate?: string | null
  currentStageId?: number | null
  status?: ObraStatus | string
}

export type ObraUpdate = {
  name?: string
  code?: string | null
  saleTypeId?: number
  address?: string | null
  city?: string | null
  neighborhood?: string | null
  startDate?: string | null
  estimatedEndDate?: string | null
  actualEndDate?: string | null
  status?: ObraStatus | string
  isActive?: ActiveStatus
}

export type ObraStageChange = {
  stageId: number
  plannedStartDate?: string | null
  plannedEndDate?: string | null
  actualStartDate?: string | null
  actualEndDate?: string | null
}

export type ObraStageHistory = {
  id: number
  obraId: number
  stageId: number
  stageName: string | null
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  createdAt?: string | null
}

export type ObraClient = {
  id: number
  obraId: number
  personId: number
  role: ObraClientRole | string
  isPrimary: number
  startDate: string | null
  endDate: string | null
  personName: string | null
  documentNumber: string | null
  createdAt?: string | null
}

export type ObraDocument = {
  id: number
  uuid: string
  obraId: number
  documentTypeId: number
  documentTypeName: string | null
  name: string
  description: string | null
  fileUrl: string
  isVisibleToClient: number
  uploadedBy: number
  createdAt?: string | null
}

export type SaleTypeOption = {
  id: number
  name: string
  isActive: ActiveStatus
}

export type StageOption = {
  id: number
  name: string
  description: string | null
  displayOrder: number
  isActive: ActiveStatus
}

export type DocumentTypeOption = {
  id: number
  name: string
  description: string | null
  isActive: ActiveStatus
}

export type { Pagination, ActiveStatus }
