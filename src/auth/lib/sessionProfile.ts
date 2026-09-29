import type { AuthUser } from '@/auth/model/types'
import { metaGet, metaSet } from '@/sync/db/database'

const PROFILE_KEY = 'authProfile'

export async function saveSessionProfile(user: AuthUser): Promise<void> {
  await metaSet(PROFILE_KEY, user)
}

export async function loadSessionProfile(): Promise<AuthUser | null> {
  const raw = await metaGet<AuthUser>(PROFILE_KEY)
  if (!raw || typeof raw !== 'object') return null
  if (!raw.username) return null
  return {
    id: raw.id,
    username: raw.username,
    email: raw.email ?? null,
    fullName: raw.fullName ?? null,
    role: raw.role ?? null,
    isSuper: Number(raw.isSuper ?? 0),
    hasFullAccess: Boolean(raw.hasFullAccess),
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
  }
}

export async function clearSessionProfile(): Promise<void> {
  await metaSet(PROFILE_KEY, null)
}
