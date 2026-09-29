import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type { ActiveStatus, Crew, CrewMember, Pagination } from '@/rrhh/model/types'

type CrewsResponse = {
  crews: Crew[]
  pagination: Pagination
}

type MembersResponse = {
  members: CrewMember[]
  pagination: Pagination
}

export async function listCrews(params: {
  page?: number
  search?: string
  activeOnly?: boolean
  obraId?: number
}): Promise<CrewsResponse> {
  return apiJson(`/api/v1/rrhh/cuadrillas${buildQuery(params)}`)
}

export async function createCrew(payload: {
  name: string
  leaderWorkerId?: number | null
  obraId?: number | null
}): Promise<Crew> {
  return apiJson('/api/v1/rrhh/cuadrillas', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateCrew(
  id: number,
  payload: {
    name?: string
    leaderWorkerId?: number | null
    obraId?: number | null
    isActive?: ActiveStatus
  },
): Promise<Crew> {
  return apiJson(`/api/v1/rrhh/cuadrillas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function listCrewMembers(
  crewId: number,
  params?: { page?: number; currentOnly?: boolean },
): Promise<MembersResponse> {
  return apiJson(
    `/api/v1/rrhh/cuadrillas/${crewId}/miembros${buildQuery(params ?? {})}`,
  )
}

export async function addCrewMember(
  crewId: number,
  workerId: number,
): Promise<CrewMember> {
  return apiJson(`/api/v1/rrhh/cuadrillas/${crewId}/miembros`, {
    method: 'POST',
    body: JSON.stringify({ workerId }),
  })
}

export async function removeCrewMember(membershipId: number): Promise<CrewMember> {
  return apiJson(`/api/v1/rrhh/cuadrillas/miembros/${membershipId}/sacar`, {
    method: 'PUT',
    body: JSON.stringify({}),
  })
}
