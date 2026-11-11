import { useRef } from 'react'
import type { Task, TaskStatus } from '@/tareas/model/types'
import { ALLOWED_STATUS_TRANSITIONS } from '@/tareas/model/types'
import { assigneeLabel, formatTaskDate, progressValue, zoneLabel } from '@/tareas/lib/taskUi'
import styles from './BitacoraBoard.module.css'

export type BoardAccent = {
  ink: string
  soft: string
  bar: string
}

type TaskCardProps = {
  task: Task
  accent: BoardAccent
  dragging?: boolean
  onDragStart: (task: Task) => void
  onDragEnd: () => void
  onClick?: (task: Task) => void
  onRequestMove?: (task: Task, toStatus: TaskStatus) => void
}

export function TaskCard({
  task,
  accent,
  dragging,
  onDragStart,
  onDragEnd,
  onClick,
  onRequestMove,
}: TaskCardProps) {
  const didDragRef = useRef(false)
  const assignee = assigneeLabel(task)
  const progress = progressValue(task)
  const attachments =
    task.attachmentCount ?? task.photoCount + (task.documentCount ?? 0)
  const dateLabel =
    task.status === 'rescheduled' && !task.plannedStartDate
      ? 'Movida'
      : formatTaskDate(task.plannedStartDate || task.plannedEndDate)

  return (
    <article
      className={`${styles.card} ${dragging ? styles.cardDragging : ''}`}
      draggable
      onClick={() => {
        if (didDragRef.current) {
          didDragRef.current = false
          return
        }
        onClick?.(task)
      }}
      onDragStart={(event) => {
        didDragRef.current = true
        event.dataTransfer.setData('text/task-id', String(task.id))
        event.dataTransfer.effectAllowed = 'move'
        onDragStart(task)
      }}
      onDragEnd={() => {
        onDragEnd()
        window.setTimeout(() => {
          didDragRef.current = false
        }, 0)
      }}
    >
      <div className={styles.cardOpen}>
        <span className={styles.cardIcon} style={{ color: accent.ink, background: accent.soft }}>
          <BoardGlyph />
        </span>
        <span className={styles.cardBody}>
          <h3 className={styles.cardTitle}>{task.name}</h3>
          <p className={styles.cardMeta}>
            {task.budgetActivityName || task.chapterName || 'Sin subcapítulo'}
            {' · '}
            {zoneLabel(task)}
          </p>
          <p className={styles.cardMeta}>
            {assignee.name}
            {' · '}
            {dateLabel}
            {attachments > 0 ? ` · ${attachments} archivo${attachments === 1 ? '' : 's'}` : ''}
          </p>
          <span className={styles.meterRow}>
            <strong style={{ color: progress > 0 ? accent.ink : '#94a3b8' }}>{progress}%</strong>
            <span className={styles.meter}>
              <span
                className={styles.meterFill}
                style={{
                  width: `${progress}%`,
                  background: progress > 0 ? accent.bar : '#e2e8f0',
                }}
              />
            </span>
          </span>
        </span>
      </div>
      {onRequestMove && ALLOWED_STATUS_TRANSITIONS[task.status].length > 0 ? (
        <div className={styles.moveRow}>
          {ALLOWED_STATUS_TRANSITIONS[task.status].map((status) => (
            <button
              key={status}
              type="button"
              className={styles.moveBtn}
              style={{ color: accent.ink }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onRequestMove(task, status)
              }}
            >
              {moveActionLabel(task.status, status)}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function statusDropAllowed(
  from: TaskStatus,
  to: TaskStatus,
): boolean {
  if (to === 'rescheduled' && from !== 'rescheduled') return false
  return true
}

function moveActionLabel(from: TaskStatus, to: TaskStatus): string {
  if (to === 'in_progress' && (from === 'scheduled' || from === 'rescheduled')) {
    return 'Iniciar'
  }
  if (to === 'completed') return 'Completar'
  if (to === 'verified') return 'Verificar'
  if (to === 'scheduled') return from === 'rescheduled' ? 'Programar' : 'Devolver'
  if (to === 'in_progress') return 'Reabrir'
  return 'Mover'
}

function BoardGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Zm2 1v4h5v-4H6Zm7 0v4h5v-4h-5ZM6 12.5v5h5v-5H6Zm7 0v5h5v-5h-5Z"
      />
    </svg>
  )
}
