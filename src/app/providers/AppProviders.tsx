import type { ReactNode } from 'react'
import { AuthProvider } from '@/auth'
import { SyncProvider } from '@/sync'
import { ToastProvider } from '@/shared/ui'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <ToastProvider>
        <SyncProvider>{children}</SyncProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
