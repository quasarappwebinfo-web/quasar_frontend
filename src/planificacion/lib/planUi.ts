import type { WorkPlanStatus, SignerStatus } from '@/planificacion/model/types'

export function planStatusTone(
  status: WorkPlanStatus,
): 'neutral' | 'success' | 'danger' {
  if (status === 'signed') return 'success'
  if (status === 'rejected') return 'danger'
  return 'neutral'
}

export function signerStatusTone(
  status: SignerStatus,
): 'neutral' | 'success' | 'danger' {
  if (status === 'signed') return 'success'
  if (status === 'rejected') return 'danger'
  return 'neutral'
}

export function formatPlanDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isPlanEditable(status: WorkPlanStatus, immutable?: boolean): boolean {
  if (immutable) return false
  return status === 'draft'
}

export function canRequestSignature(
  status: WorkPlanStatus,
  taskCount: number,
  signerCount: number,
): boolean {
  return (
    (status === 'draft' || status === 'rejected') &&
    taskCount > 0 &&
    signerCount > 0
  )
}

export function canCreateNewVersion(status: WorkPlanStatus): boolean {
  return status === 'signed' || status === 'rejected'
}
