import { createContext } from 'react'
import type { ToastInput, ToastItem, ToastTone } from './types'

export type ToastApi = {
  toasts: ToastItem[]
  notify: (input: ToastInput | string, tone?: ToastTone) => void
  success: (message: string, durationMs?: number) => void
  error: (message: string, durationMs?: number) => void
  info: (message: string, durationMs?: number) => void
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)
