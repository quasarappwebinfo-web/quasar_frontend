import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ToastContext } from './toastContext'
import type { ToastInput, ToastItem, ToastTone } from './types'
import { ToastViewport } from './ToastViewport'

const DEFAULT_DURATION = 3800

type ToastProviderProps = {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (input: ToastInput | string, tone: ToastTone = 'info') => {
      const payload: ToastInput =
        typeof input === 'string' ? { message: input, tone } : input

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const item: ToastItem = {
        id,
        message: payload.message,
        tone: payload.tone ?? tone,
        durationMs: payload.durationMs ?? DEFAULT_DURATION,
      }

      setToasts((current) => [...current, item].slice(-4))

      window.setTimeout(() => {
        dismiss(id)
      }, item.durationMs)
    },
    [dismiss],
  )

  const success = useCallback(
    (message: string, durationMs?: number) => {
      notify({ message, tone: 'success', durationMs })
    },
    [notify],
  )

  const error = useCallback(
    (message: string, durationMs?: number) => {
      notify({ message, tone: 'error', durationMs })
    },
    [notify],
  )

  const info = useCallback(
    (message: string, durationMs?: number) => {
      notify({ message, tone: 'info', durationMs })
    },
    [notify],
  )

  const value = useMemo(
    () => ({ toasts, notify, success, error, info, dismiss }),
    [toasts, notify, success, error, info, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  )
}
