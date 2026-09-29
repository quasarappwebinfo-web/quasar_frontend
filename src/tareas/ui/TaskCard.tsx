import { useRef } from 'react'
import type { Task, TaskStatus } from '@/tareas/model/types'
import {
  assigneeLabel,
  categoryColor,
  formatTaskDate,
  progressValue,
} from '@/tareas/lib/taskUi'
import styles from './tareas.module.css'

type TaskCardProps = {
  task: Task
  dragging?: boolean
  onDragStart: (task: Task) => void
  onDragEnd: () => void
  onClick?: (task: Task) => void
}

export function TaskCard({
  task,
  dragging,
  onDragStart,
  onDragEnd,
  onClick,
}: TaskCardProps) {
  const didDragRef = useRef(false)
  const assignee = assigneeLabel(task)
  const progress = progressValue(task)
  const showProgress = task.status === 'in_progress'
  const attachments =
    task.attachmentCount ??
    task.photoCount + (task.documentCount ?? 0)
  const dateLabel =
    task.status === 'rescheduled' && !task.plannedStartDate
      ? null
      : formatTaskDate(task.plannedStartDate || task.plannedEndDate)

  return (
    <article
      className={`${styles.card} ${dragging ? styles.cardDragging : ''} ${
        onClick ? styles.cardClickable : ''
      }`}
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
        // Keep flag until click (synthetic after drag) is consumed
        window.setTimeout(() => {
          didDragRef.current = false
        }, 0)
      }}
    >
      <h3 className={styles.cardTitle}>{task.name}</h3>
      {task.categoryName || task.budgetActivityName ? (
        <div className={styles.chipRow}>
          {task.categoryName ? (
            <span
              className={styles.categoryChip}
              style={{
                background: categoryColor(task.categoryName, task.categoryId),
              }}
            >
              {task.categoryName}
            </span>
          ) : null}
          {task.budgetActivityName ? (
            <span className={styles.budgetChip} title="Actividad presupuestal">
              {task.budgetActivityName}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={styles.assigneeRow}>
        <span className={styles.avatar}>{assignee.initials}</span>
        <div className={styles.assigneeMeta}>
          <p className={styles.assigneeName}>{assignee.name}</p>
          <p className={styles.assigneeRole}>{assignee.role}</p>
        </div>
      </div>

      {showProgress ? (
        <div className={styles.progressBlock}>
          <div className={styles.progressTop}>{progress}%</div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      <div className={styles.cardFooter}>
        <span className={styles.metaLeft}>
          <ClipIcon />
          {attachments}
        </span>
        {task.status === 'rescheduled' && !dateLabel ? (
          <span className={styles.movedNote}>
            <CalendarIcon accent />
            Movido…
          </span>
        ) : (
          <span className={styles.metaRight}>
            <CalendarIcon />
            {dateLabel}
          </span>
        )}
      </div>
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

function ClipIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 22 25" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.2 24.2a5.2 5.2 0 0 1-3.7-8.9L14.3 4.4a3.5 3.5 0 0 1 5 5L8.5 20.2a1.8 1.8 0 1 1-2.5-2.5l9.3-9.3 1.3 1.3-9.3 9.3a.1.1 0 0 0 0 .1.5.5 0 0 0 .7.7L19 8.1a2.2 2.2 0 0 0-3.1-3.1L5.1 15.8a3.9 3.9 0 1 0 5.5 5.5l10.8-10.8 1.3 1.3L11.9 22.6a5.2 5.2 0 0 1-4.7 1.6Z"
      />
    </svg>
  )
}

function CalendarIcon({ accent }: { accent?: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={accent ? { color: '#d95a0c' } : undefined}
    >
      <path
        fill="currentColor"
        d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2Zm13 8H4v10h16V10Zm0-2V6H4v2h16Z"
      />
    </svg>
  )
}
