import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  refreshAccessToken,
} from '@/auth/api/authApi'
import {
  clearSessionProfile,
  loadSessionProfile,
  saveSessionProfile,
} from '@/auth/lib/sessionProfile'
import { clearAccessToken, getAccessToken } from '@/auth/model/accessToken'
import { hasPermission as checkPermission } from '@/auth/model/permissions'
import type { AuthUser } from '@/auth/model/types'
import {
  AuthContext,
  type AuthStatus,
} from '@/auth/ui/authContext'

type AuthProviderProps = {
  children: ReactNode
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('bootstrapping')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [offlineSession, setOfflineSession] = useState(false)

  const applyAuthenticated = useCallback(async (next: AuthUser, offline: boolean) => {
    setUser(next)
    setOfflineSession(offline)
    setStatus('authenticated')
    if (!offline) {
      await saveSessionProfile(next)
    }
  }, [])

  const applyAnonymous = useCallback(() => {
    clearAccessToken()
    setUser(null)
    setOfflineSession(false)
    setStatus('anonymous')
  }, [])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        await refreshAccessToken()
        if (cancelled) return

        try {
          const me = await fetchMe()
          if (cancelled) return
          await applyAuthenticated(me, false)
        } catch {
          if (cancelled) return
          // refresh OK pero /me falló: sesión válida sin perfil rico
          setUser(null)
          setOfflineSession(false)
          setStatus('authenticated')
        }
      } catch {
        if (cancelled) return
        clearAccessToken()
        const cached = await loadSessionProfile()
        if (cancelled) return
        if (cached && isBrowserOffline()) {
          setUser(cached)
          setOfflineSession(true)
          setStatus('authenticated')
          return
        }
        applyAnonymous()
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [applyAuthenticated, applyAnonymous])

  useEffect(() => {
    function onOnline() {
      if (status !== 'authenticated') return
      void (async () => {
        try {
          await refreshAccessToken()
          const me = await fetchMe()
          await applyAuthenticated(me, false)
        } catch {
          // Doc: si el refresh falla al volver la red → pedir login.
          // El perfil en IDB se conserva hasta un logout explícito.
          if (getAccessToken()) return
          applyAnonymous()
        }
      })()
    }

    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [status, applyAuthenticated, applyAnonymous])

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await loginRequest(username, password)
      let nextUser = result.user

      try {
        nextUser = await fetchMe()
      } catch {
        // el login ya trajo datos suficientes
      }

      await applyAuthenticated(nextUser, false)
    },
    [applyAuthenticated],
  )

  const logout = useCallback(async () => {
    await logoutRequest()
    await clearSessionProfile()
    applyAnonymous()
  }, [applyAnonymous])

  const hasPermission = useCallback(
    (code: string | null | undefined) => checkPermission(user, code),
    [user],
  )

  const value = useMemo(
    () => ({
      status,
      user,
      offlineSession,
      login,
      logout,
      hasPermission,
    }),
    [status, user, offlineSession, login, logout, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
