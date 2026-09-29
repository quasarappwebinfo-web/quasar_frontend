import type { ActiveStatus, Pagination } from '@/identidad/model/types'

export type Worker = {
  id: number
  personId: number
  personName: string | null
  documentNumber: string | null
  workerPositionId: number | null
  positionName: string | null
  specialtyId: number | null
  specialtyName: string | null
  linkedUserId: number | null
  linkedUsername: string | null
  isActive: ActiveStatus
  deactivationReason: string | null
  createdAt?: string | null
}

export type WorkerCreate = {
  personId: number
  workerPositionId?: number | null
  specialtyId?: number | null
  linkedUserId?: number | null
}

export type WorkerUpdate = {
  workerPositionId?: number | null
  specialtyId?: number | null
  linkedUserId?: number | null
}

export type WorkerAssignment = {
  id: number
  workerId: number
  obraId: number
  startDate: string
  endDate: string | null
  assignedBy: number
  personName: string | null
  obraName: string | null
  createdAt?: string | null
}

export type Crew = {
  id: number
  name: string
  leaderWorkerId: number | null
  obraId: number | null
  isActive: ActiveStatus
  leaderName: string | null
  obraName: string | null
  createdAt?: string | null
}

export type CrewMember = {
  id: number
  crewId: number
  workerId: number
  joinedAt: string
  leftAt: string | null
  personName: string | null
  documentNumber: string | null
}

export type PositionOption = {
  id: number
  name: string
  isActive: ActiveStatus
}

export type SpecialtyOption = {
  id: number
  name: string
  workerPositionId: number | null
  isActive: ActiveStatus
}

export type { Pagination, ActiveStatus }
