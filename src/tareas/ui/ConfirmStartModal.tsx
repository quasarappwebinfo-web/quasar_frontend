import { Button, Modal } from '@/shared/ui'
import type { Task } from '@/tareas/model/types'
import styles from './tareas.module.css'

type ConfirmStartModalProps = {
  open: boolean
  task: Task | null
  confirming: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmStartModal({
  open,
  task,
  confirming,
  onClose,
  onConfirm,
}: ConfirmStartModalProps) {
  return (
    <Modal
      title="Iniciar actividad"
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" disabled={confirming} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={confirming || !task} onClick={onConfirm}>
            {confirming ? 'Iniciando…' : 'Sí, pasar a En progreso'}
          </Button>
        </>
      }
    >
      <p className={styles.confirmBody}>
        ¿Confirmas que vas a <strong>iniciar</strong> esta actividad?
      </p>
      {task ? (
        <p className={styles.confirmTaskName}>{task.name}</p>
      ) : null}
      <p className={styles.confirmHint}>
        Pasará de Programadas a En progreso. El retraso, las evidencias y marcar
        como hecha solo aplican cuando ya está en ejecución.
      </p>
    </Modal>
  )
}
