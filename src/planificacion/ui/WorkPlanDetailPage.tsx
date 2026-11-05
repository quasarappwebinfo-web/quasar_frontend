import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  planStatusTone,
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
  Badge,
  Button,
  Field,
  Modal,
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
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

  if (loading) {
    return <p className={styles.empty}>Cargando plan…</p>
  }

  if (error || !plan) {
    return (
      <div className={styles.page}>
        <Alert tone="error">{error || 'Plan no encontrado'}</Alert>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Volver
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate(`/dashboard/obras/${plan.obraId}/planes`)}
          >
            ← Planes de la obra
          </button>
          <h1 className={styles.title}>{plan.name}</h1>
          <div className={styles.metaRow}>
            <Badge tone={planStatusTone(plan.status)}>
              {WORK_PLAN_STATUS_LABELS[plan.status]}
            </Badge>
            <span className={styles.subtitle}>
              {formatPlanDate(plan.startDate)} → {formatPlanDate(plan.endDate)}
              {version ? ` · Versión ${version.versionNumber}` : ''}
              {plan.obraName ? ` · ${plan.obraName}` : ''}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          {editable ? (
            <Button
              variant="ghost"
              onClick={() => {
                setEditName(plan.name)
                setEditStart(plan.startDate)
                setEditEnd(plan.endDate)
                setEditOpen(true)
              }}
            >
              Editar cabecera
            </Button>
          ) : null}
          {canCreateNewVersion(plan.status) ? (
            <Button
              disabled={busy}
              onClick={() =>
                void runAction('Nueva versión creada', () =>
                  createWorkPlanVersion(planId, {}),
                )
              }
            >
              Nueva versión
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => navigate(`/dashboard/planes/${planId}/comparar`)}
          >
            Comparar
          </Button>
        </div>
      </header>

      <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>
              Actividades del snapshot ({current?.tasks.length || 0})
            </h2>
            {editable ? (
              <Button variant="ghost" onClick={() => void openAddTask()}>
                + Actividad
              </Button>
            ) : null}
          </div>
          {!current || current.tasks.length === 0 ? (
            <p className={styles.muted}>Sin actividades en esta versión.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Actividad</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Cant.</th>
                    <th>Duración</th>
                    {editable ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {current.tasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.taskNameSnapshot}</td>
                      <td>{formatPlanDate(task.plannedStartDate)}</td>
                      <td>{formatPlanDate(task.plannedEndDate)}</td>
                      <td>
                        {task.quantitySnapshot ?? '—'}
                        {task.unitSnapshot ? ` ${task.unitSnapshot}` : ''}
                      </td>
                      <td>
                        {task.approvedDurationDaysSnapshot ??
                          task.estimatedDurationDaysSnapshot ??
                          '—'}{' '}
                        d
                      </td>
                      {editable ? (
                        <td>
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              void runAction('Actividad quitada', () =>
                                removeWorkPlanSnapshot(task.id),
                              )
                            }
                          >
                            Quitar
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Historial de eventos</h2>
          {detail.versions.length > 1 ? (
            <div className={styles.chipList}>
              {detail.versions.map((v) => (
                <span
                  key={v.id}
                  className={`${styles.versionChip} ${
                    v.id === version?.id ? styles.versionChipActive : ''
                  }`}
                >
                  v{v.versionNumber}
                  {v.isImmutable ? ' · inmutable' : ''}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {historyEvents.length === 0 ? (
          <p className={styles.muted}>Sin eventos todavía.</p>
        ) : (
          <ul className={styles.timeline}>
            {[...historyEvents]
              .sort((a, b) =>
                String(b.eventAt || '').localeCompare(String(a.eventAt || '')),
              )
              .map((event) => (
                <li key={event.id} className={styles.timelineItem}>
                  <p className={styles.timelineTitle}>
                    {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                  </p>
                  <p className={styles.timelineMeta}>
                    {formatDateTime(event.eventAt)}
                    {event.userName ? ` · ${event.userName}` : ''}
                    {event.details ? ` · ${event.details}` : ''}
                  </p>
                </li>
              ))}
          </ul>
        )}
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
