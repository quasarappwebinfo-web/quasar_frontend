import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getObra } from '@/obras/api/obrasApi'
import { OBRA_STATUS_OPTIONS, resolveObraCover } from '@/obras/lib/obraUi'
import type { Obra } from '@/obras/model/types'
import {
  addWorkPlanTask,
  createWorkPlanVersion,
  getWorkPlan,
  removeWorkPlanSnapshot,
  updateWorkPlan,
} from '@/planificacion/api/planesApi'
import {
  canCreateNewVersion,
  formatDateTime,
  formatPlanDate,
  isPlanEditable,
} from '@/planificacion/lib/planUi'
import type { WorkPlanDetail } from '@/planificacion/model/types'
import {
  EVENT_TYPE_LABELS,
  WORK_PLAN_STATUS_LABELS,
} from '@/planificacion/model/types'
import { listTasks } from '@/tareas/api/tareasApi'
import type { Task } from '@/tareas/model/types'
import { ApiError } from '@/shared/api/apiJson'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import {
  Alert,
  Button,
  Field,
  Modal,
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
import look from '@/task-pool/ui/taskPool.module.css'
import board from '@/tareas/ui/BitacoraBoard.module.css'
import styles from './planificacion.module.css'

export function WorkPlanDetailPage() {
  const { planId: planIdParam } = useParams()
  const planId = Number(planIdParam)
  const navigate = useNavigate()
  const toast = useToast()

  const [detail, setDetail] = useState<WorkPlanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')

  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [taskToAdd, setTaskToAdd] = useState('')
  const [taskQuery, setTaskQuery] = useState('')
  const [obra, setObra] = useState<Obra | null>(null)

  useDocumentTitle(
    detail ? `Quasar · ${detail.workPlan.name}` : 'Quasar · Plan',
  )

  const load = useCallback(async () => {
    if (!Number.isFinite(planId)) {
      setError('Plan inválido')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getWorkPlan(planId)
      setDetail(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el plan')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const obraId = detail?.workPlan.obraId
    if (!obraId) return
    let cancelled = false
    void getObra(obraId)
      .then((item) => {
        if (!cancelled) setObra(item)
      })
      .catch(() => {
        if (!cancelled) setObra(null)
      })
    return () => {
      cancelled = true
    }
  }, [detail?.workPlan.obraId])

  const plan = detail?.workPlan
  const current = detail?.currentVersion
  const version = current?.version
  const editable = plan
    ? isPlanEditable(plan.status, version?.isImmutable)
    : false

  const historyEvents = [...(current?.events || [])].filter(
    (event) => event.eventType === 'created' || event.eventType === 'edited',
  )

  async function runAction(label: string, action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      toast.success(label)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo completar')
    } finally {
      setBusy(false)
    }
  }

  async function openAddTask() {
    if (!plan) return
    setAddTaskOpen(true)
    setTaskToAdd('')
    try {
      const data = await listTasks({ obraId: plan.obraId, page: 1, parentOnly: true })
      const existing = new Set(current?.tasks.map((t) => t.taskId) || [])
      setAvailableTasks(
        data.tasks.filter(
          (t) =>
            !existing.has(t.id) &&
            Boolean(t.plannedStartDate && t.plannedEndDate),
        ),
      )
    } catch {
      setAvailableTasks([])
    }
  }

  async function handleSaveHeader(event: FormEvent) {
    event.preventDefault()
    await runAction('Cabecera actualizada', () =>
      updateWorkPlan(planId, {
        name: editName.trim(),
        startDate: editStart,
        endDate: editEnd,
      }),
    )
    setEditOpen(false)
  }

  async function handleAddTask(event: FormEvent) {
    event.preventDefault()
    if (!version || !taskToAdd) return
    await runAction('Actividad agregada al snapshot', () =>
      addWorkPlanTask(version.id, { taskId: Number(taskToAdd) }),
    )
    setAddTaskOpen(false)
  }

  const tasks = (current?.tasks || []).filter((task) => {
    const needle = taskQuery.trim().toLocaleLowerCase('es')
    if (!needle) return true
    return task.taskNameSnapshot.toLocaleLowerCase('es').includes(needle)
  })
  const obraStatus = obra && obra.isActive === 1 ? obra.status : obra ? 'inactive' : ''
  const obraStatusLabel =
    OBRA_STATUS_OPTIONS.find((item) => item.value === obraStatus)?.label ||
    (obraStatus === 'inactive' ? 'Inactiva' : '')
  const weekLabel = plan ? weekTitle(plan.name, plan.startDate) : ''

  if (loading) {
    return <p className={board.empty}>Cargando plan…</p>
  }

  if (error || !plan) {
    return (
      <div className={look.catalog}>
        <Alert tone="error">{error || 'Plan no encontrado'}</Alert>
        <button type="button" className={look.quietBtn} onClick={() => navigate(-1)}>
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className={`${look.catalog} ${board.log}`}>
      <button
        type="button"
        className={look.back}
        onClick={() => navigate(`/dashboard/obras/${plan.obraId}/tareas`)}
      >
        ← Volver a las bitácoras
      </button>

      <section className={board.logHero}>
        {obra ? (
          <img className={board.cover} src={resolveObraCover(obra)} alt="" />
        ) : (
          <span className={board.cover} />
        )}
        <div>
          <div className={board.logIdentity}>
            <h1 className={board.logName}>{plan.obraName || obra?.name || `Obra #${plan.obraId}`}</h1>
            {obraStatusLabel ? (
              <span
                className={`${board.statusPill} ${
                  obraStatus === 'in_progress'
                    ? ''
                    : obraStatus === 'on_hold'
                      ? board.statusHold
                      : board.statusNeutral
                }`}
              >
                <span className={board.statusDot} />
                {obraStatusLabel}
              </span>
            ) : null}
          </div>
          <p className={board.logTitle}>{weekLabel}</p>
          <p className={board.logLead}>
            {plan.name}
            {version ? ` · Versión ${version.versionNumber}` : ''}
            {` · ${WORK_PLAN_STATUS_LABELS[plan.status]}`}
          </p>
        </div>
        <span className={board.rangeChip}>
          {formatPlanDate(plan.startDate)} – {formatPlanDate(plan.endDate)}
        </span>
      </section>

      <section className={board.logStats}>
        <article className={board.logStat}>
          <span className={board.logIcon} style={{ background: '#e8f1ff', color: '#1d4ed8' }}>
            <StatGlyph />
          </span>
          <div>
            <strong>{current?.tasks.length || 0}</strong>
            <span>Actividades</span>
          </div>
        </article>
        <article className={board.logStat}>
          <span className={board.logIcon} style={{ background: '#eef2ff', color: '#4338ca' }}>
            <StatGlyph />
          </span>
          <div>
            <strong>{version ? `v${version.versionNumber}` : '—'}</strong>
            <span>Versión vigente</span>
          </div>
        </article>
        <article className={board.logStat}>
          <span className={board.logIcon} style={{ background: '#fff4e5', color: '#c2410c' }}>
            <StatGlyph />
          </span>
          <div>
            <strong>{WORK_PLAN_STATUS_LABELS[plan.status]}</strong>
            <span>Estado del plan</span>
          </div>
        </article>
        <article className={board.logStat}>
          <span className={board.logIcon} style={{ background: '#e8f7ee', color: '#15803d' }}>
            <StatGlyph />
          </span>
          <div>
            <strong>{formatDateTime(plan.updatedAt || plan.createdAt)}</strong>
            <span>Última actualización</span>
          </div>
        </article>
      </section>

      <div className={look.filterBar}>
        <label className={look.searchBox}>
          <SearchGlyph />
          <input
            type="search"
            value={taskQuery}
            placeholder="Buscar actividad..."
            onChange={(event) => setTaskQuery(event.target.value)}
          />
        </label>
        <div className={look.heroTools}>
          {editable ? (
            <button
              type="button"
              className={look.quietBtn}
              onClick={() => {
                setEditName(plan.name)
                setEditStart(plan.startDate)
                setEditEnd(plan.endDate)
                setEditOpen(true)
              }}
            >
              Editar cabecera
            </button>
          ) : null}
          {canCreateNewVersion(plan.status) ? (
            <button
              type="button"
              className={look.quietBtn}
              disabled={busy}
              onClick={() =>
                void runAction('Nueva versión creada', () => createWorkPlanVersion(planId, {}))
              }
            >
              Nueva versión
            </button>
          ) : null}
          <button
            type="button"
            className={look.quietBtn}
            onClick={() => navigate(`/dashboard/planes/${planId}/comparar`)}
          >
            Comparar
          </button>
          <button
            type="button"
            className={look.quietBtn}
            onClick={() => navigate(`/dashboard/obras/${plan.obraId}/tareas?planId=${plan.id}`)}
          >
            Ver tablero
          </button>
          {editable ? (
            <button type="button" className={look.primaryBtn} onClick={() => void openAddTask()}>
              + Actividad
            </button>
          ) : null}
        </div>
      </div>

      {!current || current.tasks.length === 0 ? (
        <p className={board.empty}>Sin actividades en esta versión.</p>
      ) : tasks.length === 0 ? (
        <p className={board.empty}>Ninguna actividad coincide con la búsqueda.</p>
      ) : (
        <div className={look.tableCard}>
          <table className={`${look.table} ${look.phoneTable}`}>
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Cantidad</th>
                <th>Duración</th>
                {editable ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.taskNameSnapshot}</td>
                  <td data-label="Inicio">{formatPlanDate(task.plannedStartDate)}</td>
                  <td data-label="Fin">{formatPlanDate(task.plannedEndDate)}</td>
                  <td data-label="Cantidad">
                    {task.quantitySnapshot ?? '—'}
                    {task.unitSnapshot ? ` ${task.unitSnapshot}` : ''}
                  </td>
                  <td data-label="Duración">{durationLabel(task)}</td>
                  {editable ? (
                    <td data-label="Acciones">
                      <button
                        type="button"
                        className={styles.linkDanger}
                        disabled={busy}
                        onClick={() =>
                          void runAction('Actividad quitada', () => removeWorkPlanSnapshot(task.id))
                        }
                      >
                        Quitar
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className={look.tableCard}>
        <table className={`${look.table} ${look.phoneTable}`}>
          <thead>
            <tr>
              <th>Historial</th>
              <th>Cuándo</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {historyEvents.length === 0 ? (
              <tr>
                <td colSpan={3}>Sin eventos todavía.</td>
              </tr>
            ) : (
              [...historyEvents]
                .sort((a, b) => String(b.eventAt || '').localeCompare(String(a.eventAt || '')))
                .map((event) => (
                  <tr key={event.id}>
                    <td>{EVENT_TYPE_LABELS[event.eventType] || event.eventType}</td>
                    <td data-label="Cuándo">
                      {formatDateTime(event.eventAt)}
                      {event.userName ? ` · ${event.userName}` : ''}
                    </td>
                    <td data-label="Detalle">{event.details || '—'}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </section>

      <Modal
        title="Editar cabecera"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="edit-plan-header" disabled={busy}>
              Guardar
            </Button>
          </>
        }
      >
        <form id="edit-plan-header" className={styles.formGrid} onSubmit={handleSaveHeader}>
          <Field label="Nombre">
            <TextInput
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
          </Field>
          <div className={styles.twoCol}>
            <Field label="Inicio">
              <TextInput
                type="date"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                required
              />
            </Field>
            <Field label="Fin">
              <TextInput
                type="date"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                required
              />
            </Field>
          </div>
        </form>
      </Modal>

      <Modal
        title="Agregar actividad al snapshot"
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddTaskOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="add-plan-task" disabled={busy || !taskToAdd}>
              Agregar
            </Button>
          </>
        }
      >
        <form id="add-plan-task" className={styles.formGrid} onSubmit={handleAddTask}>
          <Field label="Actividad">
            <TextSelect
              value={taskToAdd}
              onChange={(e) => setTaskToAdd(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {availableTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          {availableTasks.length === 0 ? (
            <p className={styles.muted}>
              No hay más actividades elegibles (con fechas) fuera del snapshot.
            </p>
          ) : null}
        </form>
      </Modal>
    </div>
  )
}

const WEEK_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function durationLabel(task: {
  approvedDurationDaysSnapshot?: string | number | null
  estimatedDurationDaysSnapshot?: string | number | null
}): string {
  const days = task.approvedDurationDaysSnapshot ?? task.estimatedDurationDaysSnapshot
  if (days == null || days === '') return '—'
  return `${days} d`
}

function weekTitle(name: string, startDate: string): string {
  const [year, month, day] = startDate.split('-').map(Number)
  if (!year || !month || !day) return name
  return `Bitácora semana ${Math.ceil(day / 7)} ${WEEK_MONTHS[month - 1] || ''}`.trim()
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <path
        fill="currentColor"
        d="M10.5 4a6.5 6.5 0 0 1 5.17 10.45l3.44 3.44-1.42 1.42-3.44-3.44A6.5 6.5 0 1 1 10.5 4Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"
      />
    </svg>
  )
}

function StatGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M5 19V9h3v10H5Zm5.5 0V5h3v14h-3ZM16 19v-7h3v7h-3Z" />
    </svg>
  )
}
