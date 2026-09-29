import { createContext } from 'react'
import type { AuthUser } from '@/auth/model/types'

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'anonymous'

export type AuthContextValue = {
  status: AuthStatus
  user: AuthUser | null
  /** true si la sesión viene del perfil local sin access token */
  offlineSession: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (code: string | null | undefined) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
