import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { listObras } from '@/obras/api/obrasApi'
import type { Obra } from '@/obras/model/types'
import { listActiveTaskChapters } from '@/task-pool/api/capitulosApi'
import type { TaskChapter } from '@/task-pool/model/types'
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
  TextSelect,
  useToast,
} from '@/shared/ui'
import { BlockedDepsModal } from './BlockedDepsModal'
import board from './BitacoraBoard.module.css'
import { ConfirmStartModal } from './ConfirmStartModal'
import { CreateTaskFromTemplateModal } from './CreateTaskFromTemplateModal'
import { TaskCard, type BoardAccent } from './TaskCard'
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
  const [chapters, setChapters] = useState<TaskChapter[]>([])
  const [boardData, setBoard] = useState<TaskBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [chapterId, setChapterId] = useState(
    searchParams.get('chapterId') || searchParams.get('categoryId') || '',
  )
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [createOpen, setCreateOpen] = useState(false)
  const openedCreateFromQuery = useRef(false)
  const openedTaskFromQuery = useRef(false)
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
  const [startConfirmTo, setStartConfirmTo] = useState<TaskStatus | null>(null)
  const [startConfirming, setStartConfirming] = useState(false)

  useDocumentTitle(obraName ? `Quasar · ${obraName} · Bitácoras obras` : 'Quasar · Bitácoras obras')

  useEffect(() => {
    if (openedCreateFromQuery.current) return
    if (searchParams.get('nueva') !== '1') return
    openedCreateFromQuery.current = true
    setCreateOpen(true)
  }, [searchParams])

  useEffect(() => {
    if (openedTaskFromQuery.current) return
    const raw = searchParams.get('tarea')
    if (!raw) return
    const id = Number(raw)
    if (!Number.isFinite(id) || id <= 0) return
    openedTaskFromQuery.current = true
    setDetailTaskId(id)
    setDetailOpen(true)
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
      chapterId: chapterId ? Number(chapterId) : undefined,
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
  }, [obraId, chapterId, dateFrom, dateTo])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void listActiveTaskChapters()
      .then(setChapters)
      .catch(() => setChapters([]))
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
    if (chapterId) next.set('chapterId', chapterId)
    if (dateFrom) next.set('dateFrom', dateFrom)
    if (dateTo) next.set('dateTo', dateTo)
    setSearchParams(next, { replace: true })
  }, [chapterId, dateFrom, dateTo, setSearchParams])

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
    setStartConfirmTask(task)
    setStartConfirmTo(toStatus)
    setStartConfirmOpen(true)
  }

  async function handleConfirmStart() {
    if (!startConfirmTask || !startConfirmTo) return
    setStartConfirming(true)
    try {
      await applyStatusChange(startConfirmTask, startConfirmTo)
      setStartConfirmOpen(false)
      setStartConfirmTask(null)
      setStartConfirmTo(null)
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
    <div className={board.page}>
      <button
        type="button"
        className={board.back}
        onClick={() => navigate(`/dashboard/obras/${obraId}`)}
      >
        ← Volver a la obra
      </button>

      <header className={board.boardHead}>
        <div>
          <h1 className={board.title}>Tablero de Bitácora</h1>
          <p className={board.subtitle}>
            {obraName || `Obra #${obraId}`}. Arrastra una tarjeta o usa el botón para cambiar el estado.
          </p>
        </div>
        <div className={board.filters}>
          <TextSelect
            className={board.filterSelect}
            aria-label="Obra"
            value={String(obraId)}
            onChange={(event) => navigate(`/dashboard/obras/${event.target.value}/tareas`)}
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
          <TextSelect
            className={board.filterSelect}
            aria-label="Capítulo"
            value={chapterId}
            onChange={(event) => setChapterId(event.target.value)}
          >
            <option value="">Todos los capítulos</option>
            {chapters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </TextSelect>
          <input
            className={board.search}
            type="date"
            aria-label="Desde"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <input
            className={board.search}
            type="date"
            aria-label="Hasta"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => setDateTo(event.target.value)}
          />
          <input
            className={board.search}
            type="search"
            value={query}
            placeholder="Buscar actividad..."
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </header>

      <section className={board.banner}>
        <div>
          <h2 className={board.bannerTitle}>¿Necesitas agregar una actividad?</h2>
          <p className={board.bannerText}>
            Agrégala a la bitácora de esta obra o revisa sus planes.
          </p>
        </div>
        <div className={board.bannerActions}>
          <Button variant="ghost" onClick={() => navigate(`/dashboard/obras/${obraId}/planes`)}>
            Planes
          </Button>
          <Button onClick={() => setCreateOpen(true)}>Agregar actividad</Button>
        </div>
      </section>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={board.empty}>Cargando tablero…</p>
      ) : !boardData ? (
        <p className={board.empty}>Sin datos del tablero.</p>
      ) : (
        <div className={board.board}>
          {BOARD_COLUMNS.map((column) => {
            const tasks = filterBoardTasks(boardData.columns[column.key], query)
            const accent = STATUS_ACCENT[column.status]
            const open = expanded[column.key] === true
            const shown = open ? tasks : tasks.slice(0, 4)
            const hidden = tasks.length - shown.length
            return (
              <section
                key={column.key}
                className={`${board.column} ${
                  dragOverStatus === column.status ? board.columnDragOver : ''
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
                      boardData,
                      Number(event.dataTransfer.getData('text/task-id')),
                    )
                  if (task) void moveTask(task, column.status)
                  setDraggingTask(null)
                }}
              >
                <header className={board.columnHeader}>
                  <span
                    className={board.columnMark}
                    style={{ color: accent.ink, background: accent.soft }}
                  >
                    <ColumnGlyph />
                  </span>
                  <h2 className={board.columnTitle}>{column.label}</h2>
                  <span className={board.count} style={{ color: accent.ink, background: accent.soft }}>
                    {tasks.length}
                  </span>
                </header>
                <div className={board.cards}>
                  {tasks.length === 0 ? (
                    <p className={board.columnEmpty}>Sin actividades en esta columna.</p>
                  ) : (
                    shown.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        accent={accent}
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
                        onRequestMove={(item, toStatus) => {
                          void moveTask(item, toStatus)
                        }}
                      />
                    ))
                  )}
                </div>
                {tasks.length > 4 ? (
                  <button
                    type="button"
                    className={board.more}
                    style={{ color: accent.ink }}
                    onClick={() =>
                      setExpanded((current) => ({ ...current, [column.key]: !open }))
                    }
                  >
                    {open ? 'Ver menos' : `Ver más (${hidden})`}
                  </button>
                ) : null}
              </section>
            )
          })}
        </div>
      )}

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
        toStatus={startConfirmTo}
        confirming={startConfirming}
        onClose={() => {
          if (startConfirming) return
          setStartConfirmOpen(false)
          setStartConfirmTask(null)
          setStartConfirmTo(null)
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

const STATUS_ACCENT: Record<TaskStatus, BoardAccent> = {
  scheduled: { ink: '#1d4ed8', soft: '#e8f1ff', bar: '#2563eb' },
  in_progress: { ink: '#c2410c', soft: '#fff1e8', bar: '#f97316' },
  completed: { ink: '#15803d', soft: '#e8f7ee', bar: '#16a34a' },
  verified: { ink: '#0f766e', soft: '#e6f7f4', bar: '#14b8a6' },
  rescheduled: { ink: '#6d28d9', soft: '#f3e8ff', bar: '#8b5cf6' },
}

function filterBoardTasks(tasks: Task[], query: string): Task[] {
  const needle = query.trim().toLocaleLowerCase('es')
  if (!needle) return tasks
  return tasks.filter((task) => {
    const haystack = [
      task.name,
      task.chapterName,
      task.budgetActivityName,
      task.zoneName,
      task.primaryAssignee?.workerName,
      task.primaryAssignee?.crewName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('es')
    return haystack.includes(needle)
  })
}

function ColumnGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Zm2 1v4h5v-4H6Zm7 0v4h5v-4h-5ZM6 12.5v5h5v-5H6Zm7 0v5h5v-5h-5Z"
      />
    </svg>
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

  useDocumentTitle('Quasar · Bitácoras obras')

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
          <h1 className={styles.title}>Bitácoras obras</h1>
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
