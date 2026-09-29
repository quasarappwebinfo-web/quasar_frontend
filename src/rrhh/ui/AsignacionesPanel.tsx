import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  closeAssignment,
  createAssignment,
  listAssignments,
} from '@/rrhh/api/asignacionesApi'
import { listWorkers } from '@/rrhh/api/trabajadoresApi'
import type { Worker, WorkerAssignment } from '@/rrhh/model/types'
import { ApiError } from '@/shared/api/apiJson'
import {
  Alert,
  Badge,
  Button,
  Field,
  Modal,
  PaginationBar,
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
import styles from './rrhh.module.css'

export function AsignacionesPanel() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [currentOnly, setCurrentOnly] = useState(true)
  const [filterWorkerId, setFilterWorkerId] = useState('')
  const [filterObraId, setFilterObraId] = useState('')
  const [items, setItems] = useState<WorkerAssignment[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workers, setWorkers] = useState<Worker[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [workerId, setWorkerId] = useState('')
  const [obraId, setObraId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    void listWorkers({ page: 1, activeOnly: true }).then((data) => {
      setWorkers(data.workers)
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAssignments({
        page,
        currentOnly,
        workerId: filterWorkerId ? Number(filterWorkerId) : undefined,
        obraId: filterObraId ? Number(filterObraId) : undefined,
      })
      setItems(data.assignments)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar asignaciones')
    } finally {
      setLoading(false)
    }
  }, [page, currentOnly, filterWorkerId, filterObraId])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setWorkerId('')
    setObraId('')
    setStartDate(new Date().toISOString().slice(0, 10))
    setFormError(null)
    setFormOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await createAssignment({
        workerId: Number(workerId),
        obraId: Number(obraId),
        startDate,
        endDate: null,
      })
      toast.success('Trabajador asignado a la obra')
      setFormOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(err.message)
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo asignar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleClose(assignment: WorkerAssignment) {
    try {
      await closeAssignment(assignment.id)
      toast.success('Asignación cerrada (sacado de obra)')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cerrar')
    }
  }

  return (
    <section>
      <Alert tone="info">
        Aquí vinculas gente a una obra por un periodo (pool). La asistencia
        diaria con firma y “quién trabaja hoy en cada actividad” es el siguiente
        paso operativo — ver docs/asistencia-frontend.md. Sacar de obra cierra
        el vínculo (historial); no da de baja al trabajador.
      </Alert>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Field label="Trabajador">
            <TextSelect
              value={filterWorkerId}
              onChange={(e) => {
                setFilterWorkerId(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Todos</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.personName || `#${worker.id}`}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="Obra ID">
            <TextInput
              type="number"
              placeholder="Opcional"
              value={filterObraId}
              onChange={(e) => {
                setFilterObraId(e.target.value)
                setPage(1)
              }}
            />
          </Field>
          <Field label="Vigencia">
            <TextSelect
              value={currentOnly ? '1' : '0'}
              onChange={(e) => {
                setCurrentOnly(e.target.value === '1')
                setPage(1)
              }}
            >
              <option value="1">Solo vigentes</option>
              <option value="0">Historial completo</option>
            </TextSelect>
          </Field>
        </div>
        <Button onClick={openCreate}>Asignar a obra</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay asignaciones con ese filtro.</p>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((assignment) => {
            const vigente = !assignment.endDate
            return (
              <article key={assignment.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h3 className={styles.cardTitle}>
                      {assignment.personName || `Trabajador #${assignment.workerId}`}
                    </h3>
                    <p className={styles.cardSubtitle}>
                      {assignment.obraName || `Obra #${assignment.obraId}`}
                    </p>
                  </div>
                  <Badge tone={vigente ? 'success' : 'neutral'}>
                    {vigente ? 'Vigente' : 'Cerrada'}
                  </Badge>
                </div>
                <div className={styles.cardMeta}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Inicio</span>
                    <span className={styles.metaValue}>{assignment.startDate}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Fin</span>
                    <span className={styles.metaValue}>
                      {assignment.endDate || '—'}
                    </span>
                  </div>
                </div>
                {vigente ? (
                  <div className={styles.rowActions}>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void handleClose(assignment)}
                    >
                      Sacar de obra
                    </Button>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      <PaginationBar
        page={page}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onChange={setPage}
      />

      <Modal
        title="Asignar trabajador a obra"
        open={formOpen}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="assignment-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Asignar'}
            </Button>
          </>
        }
      >
        <form id="assignment-form" className={styles.formGrid} onSubmit={handleSubmit}>
          <Field label="Trabajador">
            <TextSelect
              required
              disabled={saving}
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.personName || `#${worker.id}`} ·{' '}
                  {worker.documentNumber || 's/d'}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="ID de obra" hint="Temporal hasta el módulo de obras">
            <TextInput
              required
              type="number"
              disabled={saving}
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
            />
          </Field>
          <Field label="Fecha inicio">
            <TextInput
              required
              type="date"
              disabled={saving}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>
    </section>
  )
}
