import { apiJson, buildQuery } from '@/shared/api/apiJson'
import type {
  Pagination,
  Person,
  PersonUpdate,
  PersonWrite,
} from '@/identidad/model/types'

type PersonsResponse = {
  persons: Person[]
  pagination: Pagination
}

export async function listPersons(params: {
  page?: number
  search?: string
}): Promise<PersonsResponse> {
  return apiJson(`/api/v1/identidad/personas${buildQuery(params)}`)
}

export async function getPerson(id: number): Promise<Person> {
  return apiJson(`/api/v1/identidad/personas/${id}`)
}

export async function createPerson(payload: PersonWrite): Promise<Person> {
  return apiJson('/api/v1/identidad/personas', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updatePerson(
  id: number,
  payload: PersonUpdate,
): Promise<Person> {
  return apiJson(`/api/v1/identidad/personas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
