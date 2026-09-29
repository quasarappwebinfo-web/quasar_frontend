export type ToastTone = 'success' | 'error' | 'info'

export type ToastInput = {
  message: string
  tone?: ToastTone
  durationMs?: number
}

export type ToastItem = {
  id: string
  message: string
  tone: ToastTone
  durationMs: number
}
