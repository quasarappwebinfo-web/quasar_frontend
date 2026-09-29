import type { Task, TaskStatus } from '@/tareas/model/types'
import { ALLOWED_STATUS_TRANSITIONS } from '@/tareas/model/types'

const CATEGORY_COLORS = [
  '#ffb300',
  '#054c09',
  '#830000',
  '#014cbd',
  '#d95a0c',
  '#5b2c6f',
  '#1a5276',
]

export function categoryColor(name?: string | null, id?: number | null): string {
  if (!name && !id) return '#717171'
  const seed = id ?? [...(name || '')].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return CATEGORY_COLORS[Math.abs(seed) % CATEGORY_COLORS.length]!
}

export function formatTaskDate(value?: string | null): string {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  const months = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sept',
    'Oct',
    'Nov',
    'Dic',
  ]
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]}, ${date.getFullYear()}`
}

export function assigneeLabel(task: Task): {
  initials: string
  name: string
  role: string
} {
  const a = task.primaryAssignee
  if (!a) {
    return { initials: '—', name: 'Sin asignar', role: 'Pendiente' }
  }
  const name = a.workerName || a.crewName || 'Asignado'
  const initials =
    a.initials ||
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') ||
    '—'
  return {
    initials,
    name,
    role: a.positionName || (a.crewName ? 'Cuadrilla' : 'Asignado'),
  }
}

export function progressValue(task: Task): number {
  const raw = Number(task.progressPercent)
  if (Number.isFinite(raw)) return Math.max(0, Math.min(100, Math.round(raw)))
  if (task.subtaskCount > 0) {
    return Math.round((task.subtasksDone / task.subtaskCount) * 100)
  }
  return 0
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to)
}
