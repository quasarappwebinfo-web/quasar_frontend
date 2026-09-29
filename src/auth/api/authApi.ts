import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '@/auth/model/accessToken'
import { normalizeAuthUser } from '@/auth/model/normalizeAuthUser'
import type { AuthUser, LoginResponse, MeResponse } from '@/auth/model/types'
import { API_BASE_URL } from '@/shared/api/config'

async function parseError(res: Response, fallback: string): Promise<never> {
  let detail = fallback
  try {
    const body: unknown = await res.json()
    if (
      body &&
      typeof body === 'object' &&
      'detail' in body &&
      typeof (body as { detail: unknown }).detail === 'string'
    ) {
      detail = (body as { detail: string }).detail
    }
  } catch {
    // ignore body parse errors
  }
  throw new Error(detail)
}

function readAccessToken(data: Record<string, unknown>): string | null {
  const camel = data.accessToken
  const snake = data.access_token
  if (typeof camel === 'string' && camel) return camel
  if (typeof snake === 'string' && snake) return snake
  return null
}

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

export async function login(
  username: string,
  password: string,
): Promise<{ accessToken: string; user: AuthUser }> {
  const body = new URLSearchParams()
  body.set('username', username)
  body.set('password', password)

  const res = await fetch(apiUrl('/api/v1/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: 'include',
    body,
  })

  if (!res.ok) {
    await parseError(res, 'No se pudo iniciar sesión')
  }

  const data = (await res.json()) as LoginResponse & Record<string, unknown>
  const accessToken = readAccessToken(data)
  if (!accessToken) {
    throw new Error('El servidor no devolvió access token')
  }

  setAccessToken(accessToken)

  return {
    accessToken,
    user: normalizeAuthUser(data),
  }
}

/** Evita dos refresh en paralelo (StrictMode / 401 concurrentes) que invalidan la cookie rotada. */
let refreshInFlight: Promise<string> | null = null

export async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    const res = await fetch(apiUrl('/api/v1/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    })

    if (!res.ok) {
      clearAccessToken()
      await parseError(res, 'Sesión expirada')
    }

    const data = (await res.json()) as Record<string, unknown>
    const accessToken = readAccessToken(data)
    if (!accessToken) {
      clearAccessToken()
      throw new Error('El servidor no devolvió access token')
    }

    setAccessToken(accessToken)
    return accessToken
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

export async function fetchMe(): Promise<AuthUser> {
  const token = getAccessToken()
  if (!token) {
    throw new Error('Sin access token')
  }

  const res = await fetch(apiUrl('/api/v1/auth/me'), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  })

  if (!res.ok) {
    await parseError(res, 'No se pudo obtener el usuario')
  }

  const data = (await res.json()) as MeResponse & Record<string, unknown>
  return normalizeAuthUser(data)
}

export async function logout(): Promise<void> {
  try {
    await fetch(apiUrl('/api/v1/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    })
  } finally {
    clearAccessToken()
  }
}
