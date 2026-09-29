import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { listObras } from '@/obras/api/obrasApi'
import type { Obra } from '@/obras/model/types'
import { listActiveTaskCategories } from '@/task-pool/api/categoriasApi'
import type { TaskCategory } from '@/task-pool/model/types'
import { changeTaskStatus, getTaskBoard } from '@/tareas/api/tareasApi'
import { canTransition } from '@/tareas/lib/taskUi'
import type {
  BlockingDependency,
  Task,
  TaskBoard,
  TaskStatus,
} from '@/tareas/model/types'
import { BOARD_COLUMNS } from '@/tareas/model/types'
import { ApiError } from '@/shared/api/apiJson'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { syncChangeTaskStatus, useSync, buildLocalTaskBoard, cacheBoardTasks } from '@/sync'
import {
  Alert,
  Button,
  Field,
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
import { BlockedDepsModal } from './BlockedDepsModal'
import { ConfirmStartModal } from './ConfirmStartModal'
import { CreateTaskFromTemplateModal } from './CreateTaskFromTemplateModal'
import { TaskCard } from './TaskCard'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import styles from './tareas.module.css'

export function TasksKanbanPage() {
  const { obraId: obraIdParam } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { refreshSnapshot, runSync } = useSync()

  const obraId = Number(obraIdParam)
  const [obraName, setObraName] = useState('')
  const [obras, setObras] = useState<Obra[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [board, setBoard] = useState<TaskBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || '')
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '')

  const [createOpen, setCreateOpen] = useState(false)
  const openedCreateFromQuery = useRef(false)
  const [draggingTask, setDraggingTask] = useState<Task | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null)

  const [blockedOpen, setBlockedOpen] = useState(false)
  const [blockedTask, setBlockedTask] = useState<Task | null>(null)
  const [blockers, setBlockers] = useState<BlockingDependency[]>([])
  const [forcing, setForcing] = useState(false)

  const [detailTaskId, setDetailTaskId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [startConfirmOpen, setStartConfirmOpen] = useState(false)
  const [startConfirmTask, setStartConfirmTask] = useState<Task | null>(null)
  const [startConfirming, setStartConfirming] = useState(false)

  useDocumentTitle(obraName ? `Quasar · ${obraName} · Actividades` : 'Quasar · Actividades')

  useEffect(() => {
    if (openedCreateFromQuery.current) return
    if (searchParams.get('nueva') !== '1') return
    openedCreateFromQuery.current = true
    setCreateOpen(true)
  }, [searchParams])

  const load = useCallback(async () => {
    if (!Number.isFinite(obraId)) {
      setError('Obra inválida')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const filters = {
      obraId,
      categoryId: categoryId ? Number(categoryId) : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }

    const applyBoard = (data: TaskBoard) => {
      setBoard(data)
      const sample =
        data.columns.scheduled[0] ||
        data.columns.inProgress[0] ||
        data.columns.completed[0] ||
        data.columns.verified[0] ||
        data.columns.rescheduled[0]
      if (sample?.obraName) setObraName(sample.obraName)
    }

    const tryLocal = async (prefix?: string) => {
      const local = await buildLocalTaskBoard(filters)
      if (!local) return false
      applyBoard(local)
      setError(
        prefix ??
          'Mostrando datos locales (sin red). Sincroniza cuando vuelva la conexión.',
      )
      return true
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const ok = await tryLocal()
      if (!ok) {
        setError(
          'Sin conexión y sin datos locales de esta obra. Conecta una vez para descargar.',
        )
        setBoard(null)
      }
      setLoading(false)
      return
    }

    try {
      const data = await getTaskBoard(filters)
      applyBoard(data)
      void cacheBoardTasks(data).catch(() => undefined)
    } catch (err) {
      const ok = await tryLocal(
        err instanceof Error
          ? `${err.message} · mostrando datos locales`
          : 'Error de red · mostrando datos locales',
      )
      if (!ok) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el tablero')
        setBoard(null)
      }
    } finally {
      setLoading(false)
    }
  }, [obraId, categoryId, dateFrom, dateTo])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void listActiveTaskCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
    void listObras({ page: 1, activeOnly: true })
      .then((data) => {
        setObras(data.obras)
        const current = data.obras.find((item) => item.id === obraId)
        if (current) setObraName(current.name)
      })
      .catch(() => setObras([]))
  }, [obraId])

  useEffect(() => {
    const next = new URLSearchParams()
    if (categoryId) next.set('categoryId', categoryId)
    if (dateFrom) next.set('dateFrom', dateFrom)
    if (dateTo) next.set('dateTo', dateTo)
    setSearchParams(next, { replace: true })
  }, [categoryId, dateFrom, dateTo, setSearchParams])

  const totalTasks = useMemo(() => {
    if (!board) return 0
    return (
      board.counts.scheduled +
      board.counts.inProgress +
      board.counts.completed +
      board.counts.verified +
      board.counts.rescheduled
    )
  }, [board])

  async function applyStatusChange(task: Task, toStatus: TaskStatus) {
    try {
      const result = await syncChangeTaskStatus({
        taskId: task.id,
        taskUuid: task.uuid,
        toStatus,
      })
      if (result.offline) {
        toast.success('Estado en cola offline; se sincronizará al volver la red')
        await refreshSnapshot()
      } else {
        toast.success(
          toStatus === 'in_progress'
            ? 'Actividad iniciada — ahora en progreso'
            : 'Estado actualizado',
        )
      }
      await load()
      void runSync()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = err.detail
        const deps =
          detail &&
          typeof detail === 'object' &&
          'blockingDependencies' in detail &&
          Array.isArray(
            (detail as { blockingDependencies: unknown }).blockingDependencies,
          )
            ? (detail as { blockingDependencies: BlockingDependency[] })
                .blockingDependencies
            : []
        setBlockedTask(task)
        setBlockers(deps)
        setBlockedOpen(true)
        return
      }
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar estado')
    }
  }

  async function moveTask(task: Task, toStatus: TaskStatus) {
    if (task.status === toStatus) return
    if (toStatus === 'rescheduled') {
      toast.error('Para reprogramar usa el flujo de reprogramación (próxima iteración).')
      return
    }
    if (!canTransition(task.status, toStatus)) {
      toast.error('Esa transición de estado no está permitida.')
      return
    }
    // Programadas → En progreso: pedir confirmación explícita
    if (task.status === 'scheduled' && toStatus === 'in_progress') {
      setStartConfirmTask(task)
      setStartConfirmOpen(true)
      return
    }
    await applyStatusChange(task, toStatus)
  }

  async function handleConfirmStart() {
    if (!startConfirmTask) return
    setStartConfirming(true)
    try {
      await applyStatusChange(startConfirmTask, 'in_progress')
      setStartConfirmOpen(false)
      setStartConfirmTask(null)
    } finally {
      setStartConfirming(false)
    }
  }

  async function handleForceStart() {
    if (!blockedTask) return
    setForcing(true)
    try {
      await changeTaskStatus(blockedTask.id, {
        toStatus: 'in_progress',
        force: true,
      })
      toast.success('Inicio forzado')
      setBlockedOpen(false)
      await load()
      void runSync()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo forzar')
    } finally {
      setForcing(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate(`/dashboard/obras/${obraId}`)}
          >
            ← Project View
          </button>
          <h1 className={styles.title}>{obraName || `Obra #${obraId}`}</h1>
          <p className={styles.subtitle}>
            Tablero de ejecución. Primero define un{' '}
            <button
              type="button"
              className={styles.inlineLink}
              onClick={() => navigate(`/dashboard/obras/${obraId}/planes`)}
            >
              Plan (periodo)
            </button>{' '}
            y elige las actividades a ejecutar; aquí las inicias con confirmación.
          </p>
        </div>
        <div className={styles.filters}>
          <div className={styles.filterField}>
            <Field label="Filtrar por proyecto">
              <TextSelect
                value={String(obraId)}
                onChange={(e) =>
                  navigate(`/dashboard/obras/${e.target.value}/tareas`)
                }
              >
                {obras.length === 0 ? (
                  <option value={obraId}>{obraName || `Obra #${obraId}`}</option>
                ) : null}
                {obras.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </TextSelect>
            </Field>
          </div>
          <div className={styles.filterField}>
            <Field label="Filtrar por categoría">
              <TextSelect
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Todas</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </TextSelect>
            </Field>
          </div>
          <div className={styles.filterField}>
            <Field label="Desde">
              <TextInput
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </Field>
          </div>
          <div className={styles.filterField}>
            <Field label="Hasta">
              <TextInput
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </Field>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate(`/dashboard/obras/${obraId}/planes`)}
          >
            Planes
          </Button>
          <Button onClick={() => setCreateOpen(true)}>+ Nueva Actividad</Button>
        </div>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando tablero…</p>
      ) : !board ? (
        <p className={styles.empty}>Sin datos del tablero.</p>
      ) : (
        <div className={styles.board}>
          {BOARD_COLUMNS.map((column) => {
            const tasks = board.columns[column.key]
            const count = board.counts[column.countKey]
            return (
              <section
                key={column.key}
                className={`${styles.column} ${
                  dragOverStatus === column.status ? styles.columnDragOver : ''
                }`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOverStatus(column.status)
                }}
                onDragLeave={() => {
                  setDragOverStatus((current) =>
                    current === column.status ? null : current,
                  )
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragOverStatus(null)
                  const task =
                    draggingTask ||
                    findTaskById(
                      board,
                      Number(event.dataTransfer.getData('text/task-id')),
                    )
                  if (task) void moveTask(task, column.status)
                  setDraggingTask(null)
                }}
              >
                <div className={styles.columnHeader}>
                  <h2 className={styles.columnTitle}>{column.label}</h2>
                  <span className={styles.countBadge}>{count}</span>
                  <button
                    type="button"
                    className={styles.addBtn}
                    aria-label={`Nueva actividad en ${column.label}`}
                    onClick={() => setCreateOpen(true)}
                  >
                    +
                  </button>
                </div>
                <div className={styles.cards}>
                  {tasks.length === 0 ? (
                    <p className={styles.emptyColumn}>Sin actividades</p>
                  ) : (
                    tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        dragging={draggingTask?.id === task.id}
                        onDragStart={setDraggingTask}
                        onDragEnd={() => {
                          setDraggingTask(null)
                          setDragOverStatus(null)
                        }}
                        onClick={(item) => {
                          setDetailTaskId(item.id)
                          setDetailOpen(true)
                        }}
                      />
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {!loading && board && totalTasks === 0 ? (
        <p className={styles.hint}>
          Aún no hay actividades. Usa «+ Nueva Actividad» para crear desde una Actividad Registrada
          publicada de la Base Datos Actividades.
        </p>
      ) : null}

      <CreateTaskFromTemplateModal
        open={createOpen}
        obraId={obraId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
      />

      <BlockedDepsModal
        open={blockedOpen}
        task={blockedTask}
        blockers={blockers}
        forcing={forcing}
        onClose={() => setBlockedOpen(false)}
        onForce={() => void handleForceStart()}
      />

      <ConfirmStartModal
        open={startConfirmOpen}
        task={startConfirmTask}
        confirming={startConfirming}
        onClose={() => {
          if (startConfirming) return
          setStartConfirmOpen(false)
          setStartConfirmTask(null)
        }}
        onConfirm={() => void handleConfirmStart()}
      />

      <TaskDetailDrawer
        taskId={detailTaskId}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setDetailTaskId(null)
        }}
        onChanged={() => void load()}
      />
    </div>
  )
}

function findTaskById(board: TaskBoard, id: number): Task | null {
  for (const column of BOARD_COLUMNS) {
    const found = board.columns[column.key].find((task) => task.id === id)
    if (found) return found
  }
  return null
}

export function TasksHubPage() {
  const navigate = useNavigate()
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useDocumentTitle('Quasar · Actividades')

  useEffect(() => {
    setLoading(true)
    void listObras({ page: 1, activeOnly: true })
      .then((data) => setObras(data.obras))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'No se pudieron cargar obras'),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Actividades</h1>
          <p className={styles.subtitle}>
            Elige un proyecto para abrir su tablero Kanban.
          </p>
        </div>
      </header>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? (
        <p className={styles.empty}>Cargando proyectos…</p>
      ) : obras.length === 0 ? (
        <p className={styles.empty}>No hay obras activas.</p>
      ) : (
        <div className={styles.obraPick}>
          {obras.map((obra) => (
            <button
              key={obra.id}
              type="button"
              className={styles.obraOption}
              onClick={() => navigate(`/dashboard/obras/${obra.id}/tareas`)}
            >
              <strong>{obra.name}</strong>
              <span className={styles.assigneeRole}>
                {obra.city || 'Sin ciudad'} · Abrir tablero →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
