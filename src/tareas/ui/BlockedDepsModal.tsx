import type { BlockingDependency, Task } from '@/tareas/model/types'
import { Alert, Button, Modal } from '@/shared/ui'
import styles from './tareas.module.css'

type BlockedDepsModalProps = {
  open: boolean
  task: Task | null
  blockers: BlockingDependency[]
  forcing: boolean
  onClose: () => void
  onForce: () => void
}

export function BlockedDepsModal({
  open,
  task,
  blockers,
  forcing,
  onClose,
  onForce,
}: BlockedDepsModalProps) {
  return (
    <Modal
      title="No se puede iniciar"
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Entendido
          </Button>
          <Button variant="danger" disabled={forcing} onClick={onForce}>
            {forcing ? 'Forzando…' : 'Forzar inicio'}
          </Button>
        </>
      }
    >
      <div className={styles.formGrid}>
        <Alert tone="error">
          {task
            ? `«${task.name}» tiene dependencias bloqueantes.`
            : 'Hay dependencias bloqueantes.'}
        </Alert>
        <div className={styles.warnBox}>
          Completa o verifica los prerrequisitos, o fuerza el inicio (queda
          registrado en el historial).
        </div>
        <ul className={styles.blockList}>
          {blockers.map((item) => (
            <li key={item.dependencyId} className={styles.blockItem}>
              <p className={styles.blockTitle}>
                {item.dependsOnTaskName || `Actividad #${item.dependsOnTaskId}`}
              </p>
              <p className={styles.blockText}>{item.message}</p>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
