import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { checkInObraAttendance } from '@/obras/api/asistenciaApi'
import {
  formatColombiaDate,
  todayColombiaIso,
} from '@/obras/lib/asistenciaUi'
import { listWorkers } from '@/rrhh/api/trabajadoresApi'
import type { Worker } from '@/rrhh/model/types'
import { ApiError } from '@/shared/api/apiJson'
import {
  Alert,
  Button,
  Field,
  Modal,
  TextSelect,
  useToast,
} from '@/shared/ui'
import styles from './AsistenciaModal.module.css'

type AsistenciaModalProps = {
  open: boolean
  obraId: number
  obraName: string
  /** Trabajadores ya registrados hoy (no aparecen en el selector). */
  excludeWorkerIds?: number[]
  onClose: () => void
  onChanged?: () => void
}

export function AsistenciaModal({
  open,
  obraId,
  obraName,
  excludeWorkerIds = [],
  onClose,
  onChanged,
}: AsistenciaModalProps) {
  const toast = useToast()
  const workDate = todayColombiaIso()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [workerId, setWorkerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setWorkerId('')
    setError(null)
    void listWorkers({ page: 1, activeOnly: true })
      .then((data) => setWorkers(data.workers))
      .catch(() => setWorkers([]))
  }, [open])

  const presentIds = useMemo(
    () => new Set(excludeWorkerIds),
    [excludeWorkerIds],
  )

  const availableWorkers = useMemo(
    () => workers.filter((w) => !presentIds.has(w.id)),
    [workers, presentIds],
  )

  async function handleCheckIn(event: FormEvent) {
    event.preventDefault()
    if (!workerId) {
      setError('Elige quién llegó.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await checkInObraAttendance({
        obraId,
        workDate: todayColombiaIso(),
        workerId: Number(workerId),
        signatureType: 'acknowledgment',
        signatureData: 'Registrado por administrador en obra',
      })
      toast.success('Entrada registrada')
      setWorkerId('')
      onChanged?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Asistencia · ${obraName}`}
      open={open}
      onClose={onClose}
      wide
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className={styles.layout}>
        <div className={styles.note}>
          El administrador marca quién llegó. Queda registrado quién hizo la
          entrada (tú), con fecha y hora de Colombia. No hace falta firma del
          trabajador. Una vez marcada, la llegada no se puede anular.
        </div>

        <p className={styles.todayLabel}>
          Hoy · <strong>{formatColombiaDate(workDate)}</strong>
        </p>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <form className={styles.form} onSubmit={handleCheckIn}>
          <Field label="Trabajador">
            <TextSelect
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              disabled={saving}
              required
            >
              <option value="">Seleccionar…</option>
              {availableWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.personName || `Trabajador #${worker.id}`}
                  {worker.documentNumber ? ` · ${worker.documentNumber}` : ''}
                </option>
              ))}
            </TextSelect>
          </Field>
          {availableWorkers.length === 0 ? (
            <p className={styles.muted}>
              Todos los trabajadores activos ya están registrados hoy.
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={saving || !workerId || availableWorkers.length === 0}
          >
            {saving ? 'Guardando…' : 'Registrar entrada'}
          </Button>
        </form>
      </div>
    </Modal>
  )
}
