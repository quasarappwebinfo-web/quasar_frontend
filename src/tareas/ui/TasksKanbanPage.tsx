import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getObra, listObras } from '@/obras/api/obrasApi'
import { OBRA_STATUS_OPTIONS, resolveObraCover } from '@/obras/lib/obraUi'
import type { Obra } from '@/obras/model/types'
import { formatPlanDate } from '@/planificacion/lib/planUi'
import { CreatePlanModal } from '@/planificacion/ui/CreatePlanModal'
import { WORK_PLAN_STATUS_LABELS, type WorkPlanStatus } from '@/planificacion/model/types'
import { listActiveTaskChapters } from '@/task-pool/api/capitulosApi'
import type { TaskChapter } from '@/task-pool/model/types'
import {
  changeTaskStatus,
  getObraFulfillment,
  getTaskBoard,
  listObraBitacoras,
  type ObraBitacora,
} from '@/tareas/api/tareasApi'
import { canTransition, zoneLabel } from '@/tareas/lib/taskUi'
import type {
  BlockingDependency,
  Task,
  TaskBoard,
  TaskStatus,
} from '@/tareas/model/types'
import { BOARD_COLUMNS } from '@/tareas/model/types'
import { ApiError } from '@/shared/api/apiJson'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { syncChangeTaskStatus, useSync, cacheBoardTasks } from '@/sync'
import { Alert, useToast } from '@/shared/ui'
import look from '@/task-pool/ui/taskPool.module.css'
import { CatalogPager } from '@/task-pool/ui/CatalogParts'
import { BlockedDepsModal } from './BlockedDepsModal'
import board from './BitacoraBoard.module.css'
import { ConfirmStartModal } from './ConfirmStartModal'
import { AddBitacoraActivityModal } from './AddBitacoraActivityModal'
import { TaskCard, type BoardAccent } from './TaskCard'
import { TaskDetailDrawer } from './TaskDetailDrawer'

export function TasksKanbanPage() {
  const { obraId: obraIdParam } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { refreshSnapshot, runSync } = useSync()

  const obraId = Number(obraIdParam)
  const planId = searchParams.get('planId') || ''
  const [obraName, setObraName] = useState('')
  const [obra, setObra] = useState<Obra | null>(null)
  const [periodPercent, setPeriodPercent] = useState<number | null>(null)
  const [periodCaption, setPeriodCaption] = useState('Cumplimiento global')
  const [obras, setObras] = useState<Obra[]>([])
  const [plans, setPlans] = useState<ObraBitacora[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [chapters, setChapters] = useState<TaskChapter[]>([])
  const [boardData, setBoard] = useState<TaskBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [chapterId, setChapterId] = useState(
    searchParams.get('chapterId') || searchParams.get('categoryId') || '',
  )
  const [query, setQuery] = useState('')
  const [weekQuery, setWeekQuery] = useState('')
  const [monthKey, setMonthKey] = useState('')
  const [listPage, setListPage] = useState(1)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [createOpen, setCreateOpen] = useState(false)
  const [planCreateOpen, setPlanCreateOpen] = useState(
    () => searchParams.get('nuevo') === '1',
  )
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
    if (searchParams.get('nuevo') !== '1') return
    setPlanCreateOpen(true)
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
    if (!planId) {
      setBoard(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const filters = {
      obraId,
      chapterId: chapterId ? Number(chapterId) : undefined,
      planId: Number(planId),
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

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('Sin conexión. Abre esta bitácora cuando vuelva la red.')
      setBoard(null)
      setLoading(false)
      return
    }

    try {
      const data = await getTaskBoard(filters)
      applyBoard(data)
      void cacheBoardTasks(data).catch(() => undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el tablero')
      setBoard(null)
    } finally {
      setLoading(false)
    }
  }, [obraId, chapterId, planId])

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
    void getObra(obraId)
      .then((item) => {
        setObra(item)
        setObraName(item.name)
      })
      .catch(() => setObra(null))
    void getObraFulfillment(obraId)
      .then((data) => {
        const period = data.period?.progressPercent
        if (period != null && period !== '') {
          setPeriodPercent(Number(period))
          setPeriodCaption('Cumplimiento del periodo')
          return
        }
        setPeriodPercent(Number(data.progressPercent))
        setPeriodCaption('Cumplimiento global')
      })
      .catch(() => {
        setPeriodPercent(null)
        setPeriodCaption('Cumplimiento global')
      })
  }, [obraId])

  useEffect(() => {
    let cancelled = false
    setPlansLoading(true)
    void listObraBitacoras(obraId)
      .then((data) => {
        if (!cancelled) setPlans(data.bitacoras)
      })
      .catch(() => {
        if (!cancelled) setPlans([])
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [obraId])

  useEffect(() => {
    const next = new URLSearchParams()
    if (planId) next.set('planId', planId)
    if (chapterId) next.set('chapterId', chapterId)
    if (searchParams.get('nuevo') === '1') next.set('nuevo', '1')
    if (searchParams.toString() === next.toString()) return
    setSearchParams(next, { replace: true })
  }, [planId, chapterId, searchParams, setSearchParams])

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

  const selectedPlan = plans.find((plan) => String(plan.id) === planId) ?? null
  const selectedLabel = selectedPlan
    ? bitacoraLabel(selectedPlan, plans)
    : 'Bitácora'

  const monthOptions = monthChoices(plans)
  const visiblePlans = plans.filter((plan) => {
    if (monthKey && !plan.startDate.startsWith(monthKey)) return false
    const needle = weekQuery.trim().toLocaleLowerCase('es')
    if (!needle) return true
    const haystack = `${bitacoraLabel(plan, plans)} ${formatPlanDate(plan.startDate)} ${formatPlanDate(plan.endDate)}`.toLocaleLowerCase('es')
    return haystack.includes(needle)
  })
  const pagePlans = visiblePlans.slice((listPage - 1) * LIST_PAGE_SIZE, listPage * LIST_PAGE_SIZE)
  const latest = plans[0]
  const obraStatus = obra && obra.isActive === 1 ? obra.status : 'inactive'
  const statusLabel =
    OBRA_STATUS_OPTIONS.find((item) => item.value === obraStatus)?.label ||
    (obraStatus === 'inactive' ? 'Inactiva' : obraStatus)

  function openPlan(id: number) {
    const next = new URLSearchParams()
    next.set('planId', String(id))
    if (chapterId) next.set('chapterId', chapterId)
    setSearchParams(next)
  }

  if (!planId) {
    return (
      <div className={`${look.catalog} ${board.log}`}>
        <button
          type="button"
          className={look.back}
          onClick={() => navigate(`/dashboard/obras/${obraId}`)}
        >
          ← Volver a la obra
        </button>

        <section className={board.logHero}>
          {obra ? (
            <img className={board.cover} src={resolveObraCover(obra)} alt="" />
          ) : (
            <span className={board.cover} />
          )}
          <div>
            <div className={board.logIdentity}>
              <h1 className={board.logName}>{obraName || `Obra #${obraId}`}</h1>
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
                {statusLabel}
              </span>
            </div>
            <p className={board.logTitle}>Bitácoras de la obra</p>
            <p className={board.logLead}>
              Cada fila es una semana. Ábrela para ver y mover sus actividades.
            </p>
          </div>
          <span className={board.rangeChip}>{planSpan(plans)}</span>
        </section>

        <section className={board.logStats}>
          <article className={board.logStat}>
            <span className={board.logIcon} style={{ background: '#e8f1ff', color: '#1d4ed8' }}>
              <BookGlyph />
            </span>
            <div>
              <strong>{plansLoading ? '…' : plans.length}</strong>
              <span>Bitácoras registradas</span>
            </div>
          </article>
          <article className={board.logStat}>
            <span className={board.logIcon} style={{ background: '#e8f7ee', color: '#15803d' }}>
              <CheckGlyph />
            </span>
            <div>
              <strong>{periodPercent == null || !Number.isFinite(periodPercent) ? '—' : `${formatPercent(periodPercent)}%`}</strong>
              <span>{periodCaption}</span>
            </div>
          </article>
          <article className={board.logStat}>
            <span className={board.logIcon} style={{ background: '#fff4e5', color: '#c2410c' }}>
              <CalendarGlyph />
            </span>
            <div>
              <strong>{latest ? bitacoraLabel(latest, plans) : 'Sin semanas'}</strong>
              <span>Semana más reciente</span>
            </div>
          </article>
          <article className={board.logStat}>
            <span className={board.logIcon} style={{ background: '#eef2ff', color: '#4338ca' }}>
              <CalendarGlyph />
            </span>
            <div>
              <strong>{latest ? `${formatPlanDate(latest.startDate)} – ${formatPlanDate(latest.endDate)}` : '—'}</strong>
              <span>Periodo de esa semana</span>
            </div>
          </article>
        </section>

        <div className={look.filterBar}>
          <label className={look.searchBox}>
            <SearchGlyph />
            <input
              type="search"
              value={weekQuery}
              placeholder="Buscar semana..."
              onChange={(event) => {
                setWeekQuery(event.target.value)
                setListPage(1)
              }}
            />
          </label>
          <label className={look.filterField}>
            Mes
            <select
              value={monthKey}
              onChange={(event) => {
                setMonthKey(event.target.value)
                setListPage(1)
              }}
            >
              <option value="">Todos</option>
              {monthOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <ObraField
            obraId={obraId}
            obraName={obraName}
            obras={obras}
            onChange={(id) => {
              setMonthKey('')
              setWeekQuery('')
              setListPage(1)
              navigate(`/dashboard/obras/${id}/tareas`)
            }}
          />
        </div>

        {plansLoading ? (
          <p className={board.empty}>Cargando bitácoras…</p>
        ) : plans.length === 0 ? (
          <p className={board.empty}>Esta obra todavía no tiene bitácoras semanales.</p>
        ) : visiblePlans.length === 0 ? (
          <p className={board.empty}>Ninguna semana coincide con la búsqueda.</p>
        ) : (
          <div className={look.tableCard}>
            <table className={`${look.table} ${look.phoneTable}`}>
              <thead>
                <tr>
                  <th>Semana</th>
                  <th>Periodo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagePlans.map((plan) => (
                  <tr key={plan.id}>
                    <td>{bitacoraLabel(plan, plans)}</td>
                    <td data-label="Periodo">
                      {formatPlanDate(plan.startDate)} – {formatPlanDate(plan.endDate)}
                    </td>
                    <td data-label="Estado">{planStatusLabel(plan.status)}</td>
                    <td data-label="Acciones">
                      <div className={board.rowActions}>
                        <button
                          type="button"
                          className={board.openBtn}
                          onClick={() => navigate(`/dashboard/planes/${plan.id}`)}
                        >
                          Ver bitácora
                        </button>
                        <button type="button" className={board.openBtn} onClick={() => openPlan(plan.id)}>
                          Ver tablero
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={board.logFoot}>
          <CatalogPager
            page={listPage}
            totalItems={visiblePlans.length}
            itemsPerPage={LIST_PAGE_SIZE}
            noun="bitácoras"
            onChange={setListPage}
          />
          <button
            type="button"
            className={look.primaryBtn}
            onClick={() => setPlanCreateOpen(true)}
          >
            + Nueva bitácora
          </button>
        </div>

        <CreatePlanModal
          open={planCreateOpen}
          obraId={obraId}
          obraName={obraName}
          onClose={() => {
            setPlanCreateOpen(false)
            if (searchParams.get('nuevo') !== '1') return
            const next = new URLSearchParams(searchParams)
            next.delete('nuevo')
            setSearchParams(next, { replace: true })
          }}
          onCreated={(planId) => navigate(`/dashboard/planes/${planId}`)}
        />
      </div>
    )
  }

  return (
    <div className={`${look.catalog} ${board.page}`}>
      <header className={look.hero}>
        <button
          type="button"
          className={look.back}
          onClick={() => {
            const next = new URLSearchParams()
            if (chapterId) next.set('chapterId', chapterId)
            setSearchParams(next)
          }}
        >
          ← Bitácoras de la obra
        </button>
        <div className={look.heroRow}>
          <div>
            <h1 className={look.catalogTitle}>{selectedLabel}</h1>
            <p className={look.catalogLead}>
              {obraName || `Obra #${obraId}`}
              {selectedPlan
                ? ` · ${formatPlanDate(selectedPlan.startDate)} – ${formatPlanDate(selectedPlan.endDate)}`
                : ''}
              . Arrastra una tarjeta o usa el botón para cambiar el estado.
            </p>
          </div>
          <div className={look.heroTools}>
            <button
              type="button"
              className={look.quietBtn}
              onClick={() => {
                const next = new URLSearchParams()
                if (chapterId) next.set('chapterId', chapterId)
                setSearchParams(next)
              }}
            >
              Bitácoras
            </button>
            <button type="button" className={look.primaryBtn} onClick={() => setCreateOpen(true)}>
              + Agregar actividad
            </button>
          </div>
        </div>
      </header>

      <div className={look.filterBar}>
        <ObraField
          obraId={obraId}
          obraName={obraName}
          obras={obras}
          onChange={(id) => navigate(`/dashboard/obras/${id}/tareas`)}
        />
        <label className={look.filterField}>
          Bitácora
          <select
            aria-label="Bitácora"
            value={planId}
            onChange={(event) => {
              const next = new URLSearchParams()
              next.set('planId', event.target.value)
              if (chapterId) next.set('chapterId', chapterId)
              setSearchParams(next)
            }}
          >
            {plans.length === 0 ? <option value={planId}>{selectedLabel}</option> : null}
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {bitacoraLabel(plan, plans)}
              </option>
            ))}
          </select>
        </label>
        <label className={look.filterField}>
          Capítulo
          <select
            aria-label="Capítulo"
            value={chapterId}
            onChange={(event) => setChapterId(event.target.value)}
          >
            <option value="">Todos</option>
            {chapters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className={look.filterField}>
          Actividad
          <input
            type="search"
            value={query}
            placeholder="Buscar..."
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className={look.clearFilters}
          onClick={() => {
            setChapterId('')
            setQuery('')
          }}
        >
          Limpiar filtros
        </button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={board.empty}>Cargando tablero…</p>
      ) : !boardData ? (
        <p className={board.empty}>Sin datos del tablero.</p>
      ) : (
        <>
        <div className={board.summary}>
          {BOARD_COLUMNS.map((column) => {
            const accent = STATUS_ACCENT[column.status]
            const total = filterBoardTasks(boardData.columns[column.key], query).length
            return (
              <div key={column.key} className={board.summaryCard}>
                <span className={board.summaryValue} style={{ color: accent.ink }}>
                  {total}
                </span>
                <span className={board.summaryLabel}>{column.label}</span>
              </div>
            )
          })}
        </div>
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
        </>
      )}

      <AddBitacoraActivityModal
        open={createOpen}
        obraId={obraId}
        planId={Number(planId)}
        onClose={() => setCreateOpen(false)}
        onAdded={() => void load()}
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
      zoneLabel(task),
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

const MONTHS = [
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

function weekKey(startDate: string): string {
  const [year, month, day] = startDate.split('-').map(Number)
  if (!year || !month || !day) return startDate
  return `${year}-${month}-${Math.ceil(day / 7)}`
}

function bitacoraLabel(plan: ObraBitacora, plans: ObraBitacora[]): string {
  const [year, month, day] = plan.startDate.split('-').map(Number)
  if (!year || !month || !day) return plan.name
  const week = Math.ceil(day / 7)
  const base = `Bitácora semana ${week} ${MONTHS[month - 1] || ''}`.trim()
  const twins = plans.filter((item) => weekKey(item.startDate) === weekKey(plan.startDate))
  if (twins.length > 1) return `${base} · ${formatPlanDate(plan.startDate)}`
  return base
}

function ObraField({
  obraId,
  obraName,
  obras,
  onChange,
}: {
  obraId: number
  obraName: string
  obras: Obra[]
  onChange: (obraId: number) => void
}) {
  return (
    <label className={look.filterField}>
      Obra
      <select
        aria-label="Obra"
        value={String(obraId)}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {obras.length === 0 ? (
          <option value={obraId}>{obraName || `Obra #${obraId}`}</option>
        ) : null}
        {obras.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  )
}

const LIST_PAGE_SIZE = 8

function monthChoices(plans: ObraBitacora[]): { key: string; label: string }[] {
  const seen = new Map<string, string>()
  for (const plan of plans) {
    const [year, month] = plan.startDate.split('-')
    if (!year || !month) continue
    const key = `${year}-${month}`
    if (!seen.has(key)) {
      seen.set(key, `${MONTHS[Number(month) - 1] || month} ${year}`)
    }
  }
  return [...seen.entries()].map(([key, label]) => ({ key, label }))
}

function planSpan(plans: ObraBitacora[]): string {
  if (plans.length === 0) return 'Sin semanas'
  const starts = plans.map((plan) => plan.startDate).sort()
  const ends = plans.map((plan) => plan.endDate).sort()
  return `${formatPlanDate(starts[0])} – ${formatPlanDate(ends[ends.length - 1])}`
}

function planStatusLabel(status: string): string {
  if (status in WORK_PLAN_STATUS_LABELS) {
    return WORK_PLAN_STATUS_LABELS[status as WorkPlanStatus]
  }
  return status
}

function BookGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 0-2 2V4Zm0 0a2 2 0 0 0-2 2v14" />
    </svg>
  )
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1.1 10.2-2.3-2.3-1.2 1.2 3.5 3.5 6.2-6.2-1.2-1.2-5 5Z" />
    </svg>
  )
}

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M7 3h2v2h6V3h2v2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2V3Zm12 8H5v8h14v-8Z" />
    </svg>
  )
}

function obraInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatPercent(value: number | string | null | undefined): string {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 2,
  }).format(amount)
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 4a6.5 6.5 0 0 1 5.17 10.45l3.44 3.44-1.42 1.42-3.44-3.44A6.5 6.5 0 1 1 10.5 4Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"
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
  const [query, setQuery] = useState('')

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

  const visible = obras.filter((obra) => {
    const needle = query.trim().toLocaleLowerCase('es')
    if (!needle) return true
    return `${obra.name} ${obra.city || ''} ${obra.neighborhood || ''}`
      .toLocaleLowerCase('es')
      .includes(needle)
  })

  return (
    <div className={look.catalog}>
      <header className={look.hero}>
        <div className={look.heroRow}>
          <div>
            <h1 className={look.catalogTitle}>Bitácoras obras</h1>
            <p className={look.catalogLead}>
              Elige un proyecto para ver sus bitácoras por semana.
            </p>
          </div>
          <div className={look.heroTools}>
            <label className={look.searchBox}>
              <SearchGlyph />
              <input
                type="search"
                value={query}
                placeholder="Buscar obra o ciudad..."
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
        </div>
      </header>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? (
        <p className={board.empty}>Cargando proyectos…</p>
      ) : obras.length === 0 ? (
        <p className={board.empty}>No hay obras activas.</p>
      ) : visible.length === 0 ? (
        <p className={board.empty}>Ninguna obra coincide con la búsqueda.</p>
      ) : (
        <div className={board.pickGrid}>
          {visible.map((obra) => {
            const place = [obra.city, obra.neighborhood].filter(Boolean).join(' · ')
            const progress = houseWidth(obra.progressPercent)
            return (
              <button
                key={obra.id}
                type="button"
                className={board.pickCard}
                onClick={() => navigate(`/dashboard/obras/${obra.id}/tareas`)}
              >
                <span className={board.pickMark}>{obraInitials(obra.name)}</span>
                <span className={board.pickBody}>
                  <span className={board.pickName}>{obra.name}</span>
                  <span className={board.pickMeta}>{place || 'Sin ciudad'}</span>
                  {progress != null ? (
                    <span className={board.meterBlock}>
                      <span className={board.meterTop}>
                        <span>Cumplimiento global</span>
                        <strong>{formatPercent(obra.progressPercent)}%</strong>
                      </span>
                      <span className={board.meter}>
                        <span
                          className={board.meterFill}
                          style={{ width: `${progress}%`, background: '#2563eb' }}
                        />
                      </span>
                    </span>
                  ) : null}
                </span>
                <span className={board.pickGo} aria-hidden="true">
                  →
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function houseWidth(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return null
  return Math.min(100, Math.max(0, amount))
}
