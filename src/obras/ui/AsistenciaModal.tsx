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
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
import styles from './AsistenciaModal.module.css'

async function listActiveWorkers(): Promise<Worker[]> {
  const all: Worker[] = []
  let page = 1
  let total = 0
  do {
    const data = await listWorkers({ page, activeOnly: true })
    all.push(...data.workers)
    total = data.pagination.totalItems
    if (data.workers.length === 0) break
    page += 1
  } while (all.length < total && page <= 80)
  all.sort((a, b) =>
    (a.personName || '').localeCompare(b.personName || '', 'es'),
  )
  return all
}

type AsistenciaModalProps = {
  open: boolean
  obraId: number
  obraName: string
  /** Trabajadores ya registrados ese día (no aparecen en el selector). */
  excludeWorkerIds?: number[]
  workDate?: string
  onClose: () => void
  onChanged?: () => void
}

export function AsistenciaModal({
  open,
  obraId,
  obraName,
  excludeWorkerIds = [],
  workDate = todayColombiaIso(),
  onClose,
  onChanged,
}: AsistenciaModalProps) {
  const toast = useToast()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [query, setQuery] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setWorkerId('')
    setQuery('')
    setError(null)
    setLoading(true)
    void listActiveWorkers()
      .then(setWorkers)
      .catch(() => setWorkers([]))
      .finally(() => setLoading(false))
  }, [open])

  const presentIds = useMemo(
    () => new Set(excludeWorkerIds),
    [excludeWorkerIds],
  )

  const availableWorkers = useMemo(() => {
    const term = query.trim().toLowerCase()
    return workers.filter((worker) => {
      if (presentIds.has(worker.id)) return false
      if (!term) return true
      const name = (worker.personName || '').toLowerCase()
      const document = (worker.documentNumber || '').toLowerCase()
      return name.includes(term) || document.includes(term)
    })
  }, [workers, presentIds, query])

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
        workDate,
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
          trabajador. Si alguien quedó marcado por error, solo el super
          administrador puede quitar esa llegada. Esos días entran en
          Reportes: valor día × días trabajados, y en qué obra estuvo cada día.
        </div>

        <p className={styles.todayLabel}>
          {workDate === todayColombiaIso() ? 'Hoy' : 'Día'} ·{' '}
          <strong>{formatColombiaDate(workDate)}</strong>
        </p>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <form className={styles.form} onSubmit={handleCheckIn}>
          <Field label="Buscar">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre o documento"
              disabled={loading || saving}
            />
          </Field>
          <Field label="Trabajador">
            <TextSelect
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              disabled={saving || loading}
              required
            >
              <option value="">
                {loading ? 'Cargando trabajadores…' : 'Seleccionar…'}
              </option>
              {availableWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.personName || `Trabajador #${worker.id}`}
                  {worker.documentNumber ? ` · ${worker.documentNumber}` : ''}
                </option>
              ))}
            </TextSelect>
          </Field>
          {loading ? (
            <p className={styles.muted}>Cargando el personal activo…</p>
          ) : availableWorkers.length === 0 ? (
            <p className={styles.muted}>
              {query.trim()
                ? 'Nadie coincide con esa búsqueda.'
                : 'Todos los trabajadores activos ya están registrados hoy.'}
            </p>
          ) : (
            <p className={styles.muted}>
              {availableWorkers.length}{' '}
              {availableWorkers.length === 1 ? 'trabajador' : 'trabajadores'}
            </p>
          )}
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
