import { refreshAccessToken } from '@/auth/api/authApi'
import { getAccessToken } from '@/auth/model/accessToken'
import { API_BASE_URL } from '@/shared/api/config'

type ApiFetchOptions = RequestInit & {
  /** Si true, no intenta refresh ante 401 (útil en bootstrap). */
  skipAuthRefresh?: boolean
}

/**
 * fetch autenticado: Bearer en memoria + credentials.
 * Ante 401 intenta refresh una vez y reintenta.
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const { skipAuthRefresh = false, ...init } = options
  const headers = new Headers(init.headers)

  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`

  let res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (res.status === 401 && !skipAuthRefresh) {
    await refreshAccessToken()
    const nextToken = getAccessToken()
    if (nextToken) {
      headers.set('Authorization', `Bearer ${nextToken}`)
    }
    res = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
    })
  }

  return res
}
