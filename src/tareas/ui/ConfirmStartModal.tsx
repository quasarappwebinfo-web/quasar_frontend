import { Button, Modal } from '@/shared/ui'
import type { Task, TaskStatus } from '@/tareas/model/types'
import { TASK_STATUS_LABELS } from '@/tareas/model/types'
import styles from './tareas.module.css'

type ConfirmStartModalProps = {
  open: boolean
  task: Task | null
  toStatus: TaskStatus | null
  confirming: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmStartModal({
  open,
  task,
  toStatus,
  confirming,
  onClose,
  onConfirm,
}: ConfirmStartModalProps) {
  const fromLabel = task ? TASK_STATUS_LABELS[task.status] : ''
  const toLabel = toStatus ? TASK_STATUS_LABELS[toStatus] : ''
  const starting = task?.status === 'scheduled' && toStatus === 'in_progress'

  return (
    <Modal
      title="Cambiar estado"
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" disabled={confirming} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={confirming || !task || !toStatus} onClick={onConfirm}>
            {confirming ? 'Guardando…' : `Sí, pasar a ${toLabel}`}
          </Button>
        </>
      }
    >
      <p className={styles.confirmBody}>
        ¿Confirmas cambiar el estado de esta actividad?
      </p>
      {task ? <p className={styles.confirmTaskName}>{task.name}</p> : null}
      {task && toStatus ? (
        <p className={styles.confirmHint}>
          Pasará de <strong>{fromLabel}</strong> a <strong>{toLabel}</strong>.
          {starting
            ? ' El retraso, las evidencias y marcar como hecha solo aplican cuando ya está en ejecución.'
            : ' El cambio queda registrado en la actividad.'}
        </p>
      ) : null}
    </Modal>
  )
}
