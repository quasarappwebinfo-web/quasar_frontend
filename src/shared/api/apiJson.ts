import { apiFetch } from '@/auth'

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function messageFromDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg)
        }
        return String(item)
      })
      .join('. ')
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const nested = (detail as { message?: unknown }).message
    if (typeof nested === 'string') return nested
  }
  return fallback
}

async function readErrorBody(
  res: Response,
  fallback: string,
): Promise<{ message: string; detail: unknown }> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'detail' in body) {
      const detail = (body as { detail: unknown }).detail
      return { message: messageFromDetail(detail, fallback), detail }
    }
  } catch {
    // ignore
  }
  return { message: fallback, detail: undefined }
}

export async function apiJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await apiFetch(path, { ...options, headers })

  if (!res.ok) {
    const { message, detail } = await readErrorBody(res, 'Error en la solicitud')
    throw new ApiError(res.status, message, detail)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

/** Multipart: no fijar Content-Type (el browser pone el boundary). */
export async function apiFormData<T>(
  path: string,
  form: FormData,
  method: 'POST' | 'PUT' = 'PUT',
): Promise<T> {
  return apiJson<T>(path, { method, body: form })
}

export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}
