import type { Obra, ObraStatus, StageOption } from '@/obras/model/types'

export const OBRA_STATUS_OPTIONS: { value: ObraStatus; label: string }[] = [
  { value: 'planning', label: 'Planificación' },
  { value: 'in_progress', label: 'En ejecución' },
  { value: 'on_hold', label: 'Pausada' },
  { value: 'completed', label: 'Finalizada' },
  { value: 'cancelled', label: 'Cancelada' },
]

export function isObraFinished(obra: Pick<Obra, 'status'>): boolean {
  return obra.status === 'completed' || obra.status === 'cancelled'
}

export function isObraActiveWork(obra: Pick<Obra, 'status' | 'isActive'>): boolean {
  return (
    obra.isActive === 1 &&
    (obra.status === 'planning' ||
      obra.status === 'in_progress' ||
      obra.status === 'on_hold')
  )
}

/** Heurística UI (Figma): retraso si pasó estimatedEndDate y aún no termina. */
export function isObraDelayed(obra: Pick<Obra, 'status' | 'estimatedEndDate'>): boolean {
  if (isObraFinished(obra) || !obra.estimatedEndDate) return false
  const end = new Date(`${obra.estimatedEndDate}T23:59:59`)
  return end.getTime() < Date.now()
}

export function obraTimelineLabel(obra: Pick<Obra, 'status' | 'estimatedEndDate'>): {
  label: string
  tone: 'ok' | 'delay' | 'done' | 'neutral'
} {
  if (obra.status === 'completed') return { label: 'Lista', tone: 'done' }
  if (obra.status === 'cancelled') return { label: 'Cancelada', tone: 'neutral' }
  if (isObraDelayed(obra)) return { label: 'Retraso', tone: 'delay' }
  if (obra.status === 'on_hold') return { label: 'Pausada', tone: 'neutral' }
  if (obra.status === 'planning') return { label: 'Planificación', tone: 'neutral' }
  return { label: 'A tiempo', tone: 'ok' }
}

export function estimateObraProgress(
  obra: Pick<Obra, 'status' | 'currentStageId'>,
  stages: StageOption[],
): number {
  if (obra.status === 'completed') return 100
  if (obra.status === 'cancelled' || !obra.currentStageId || stages.length === 0) {
    return obra.status === 'planning' ? 5 : 0
  }
  const ordered = [...stages].sort((a, b) => a.displayOrder - b.displayOrder)
  const index = ordered.findIndex((stage) => stage.id === obra.currentStageId)
  if (index < 0) return 10
  return Math.round(((index + 1) / ordered.length) * 100)
}

export function coverForObra(id: number): string {
  const covers = [
    '/obras/cover-1.png',
    '/obras/cover-2.png',
    '/obras/cover-3.png',
  ]
  return covers[id % covers.length]!
}

/** Cover real de API o placeholder local. */
export function resolveObraCover(
  obra: Pick<Obra, 'id' | 'coverImageUrl'>,
): string {
  return obra.coverImageUrl?.trim() || coverForObra(obra.id)
}

export const OBRA_COVER_MAX_BYTES = 15 * 1024 * 1024
export const OBRA_COVER_ACCEPT = 'image/jpeg,image/png,image/webp'

export function validateObraCoverFile(file: File): string | null {
  const okType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  if (!okType) return 'Usa JPEG, PNG o WebP.'
  if (file.size > OBRA_COVER_MAX_BYTES) return 'La imagen no puede superar 15 MB.'
  return null
}

export function formatObraLocation(obra: Pick<Obra, 'city' | 'neighborhood'>): string {
  const parts = [obra.neighborhood, obra.city].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Sin ubicación'
}

export type StageStepState = 'done' | 'current' | 'next'

export function stageStepState(
  stageId: number,
  orderedStages: StageOption[],
  currentStageId: number | null,
  obraStatus: string,
): StageStepState {
  if (obraStatus === 'completed') return 'done'
  if (!currentStageId) {
    return orderedStages[0]?.id === stageId ? 'current' : 'next'
  }
  const currentIndex = orderedStages.findIndex((s) => s.id === currentStageId)
  const index = orderedStages.findIndex((s) => s.id === stageId)
  if (index < 0) return 'next'
  if (index < currentIndex) return 'done'
  if (index === currentIndex) return 'current'
  return 'next'
}

export function stageStepLabel(state: StageStepState): string {
  if (state === 'done') return 'Terminado'
  if (state === 'current') return 'En Progreso...'
  return 'Siguiente'
}
