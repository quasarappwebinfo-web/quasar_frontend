import { Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '@/app/ui/AppShell'
import { BootScreen } from '@/app/ui/BootScreen'
import { useAuth } from '@/auth'
import { hasAnyPermission, hasPermission } from '@/auth/model/permissions'

export function ProtectedRoute() {
  const { status } = useAuth()

  if (status === 'bootstrapping') {
    return <BootScreen />
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export function PublicOnlyRoute() {
  const { status } = useAuth()

  if (status === 'bootstrapping') {
    return <BootScreen />
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

type RequirePermissionProps = {
  /** Un permiso o varios (OR). */
  permission?: string | string[]
  children?: never
}

/** Protege rutas por código de módulo. Sin permiso → dashboard. */
export function RequirePermission({ permission }: RequirePermissionProps) {
  const { status, user } = useAuth()

  if (status === 'bootstrapping') {
    return <BootScreen />
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  const codes = Array.isArray(permission)
    ? permission
    : permission
      ? [permission]
      : []

  const allowed =
    codes.length === 0 ||
    (codes.length === 1
      ? hasPermission(user, codes[0])
      : hasAnyPermission(user, codes))

  if (!allowed) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
