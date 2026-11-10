import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { hasPermission, useAuth } from '@/auth'
import { getObra } from '@/obras/api/obrasApi'
import { ObraActivityModal } from '@/obras/ui/ObraActivityModal'
import { listActiveTaskBudgetActivities } from '@/task-pool/api/actividadesPresupuestalesApi'
import { listActiveTaskChapters } from '@/task-pool/api/capitulosApi'
import { compareChapterNames, chapterSortRank, sortChapters } from '@/task-pool/lib/chapterOrder'
import type { TaskBudgetActivity, TaskChapter } from '@/task-pool/model/types'
import {
  deleteTask,
  getObraFulfillment,
  listTaskRemovals,
  listTasks,
  type TaskRemoval,
} from '@/tareas/api/tareasApi'
import type { ObraFulfillment, Task } from '@/tareas/model/types'
import { TaskDetailDrawer } from '@/tareas/ui/TaskDetailDrawer'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { Alert, Button, Modal, TextSelect, useToast } from '@/shared/ui'
import styles from './ObraActivities.module.css'

type Column = {
  key: string
  name: string
  progress: number
  tasks: Task[]
}

export function ObraActivitiesPage() {
  const { obraId } = useParams()
  const id = Number(obraId)
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const canRemove = hasPermission(user, 'tareas')

  const [obraName, setObraName] = useState('')
  const [chapters, setChapters] = useState<TaskChapter[]>([])
  const [budgetActivities, setBudgetActivities] = useState<TaskBudgetActivity[]>([])
  const [chapterId, setChapterId] = useState('')
  const [budgetActivityId, setBudgetActivityId] = useState('')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [tasks, setTasks] = useState<Task[]>([])
  const [fulfillment, setFulfillment] = useState<ObraFulfillment | null>(null)
  const [removals, setRemovals] = useState<TaskRemoval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState<'pool' | 'obra' | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [pending, setPending] = useState<Task | null>(null)
  const [removing, setRemoving] = useState(false)

  useDocumentTitle(
    obraName ? `Quasar · ${obraName} · Actividades` : 'Quasar · Actividades de la obra',
  )

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setError('Obra inválida')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [obra, chapterRows, budgetRows, fulfillmentData, removalData, taskRows] =
        await Promise.all([
          getObra(id),
          listActiveTaskChapters().catch(() => [] as TaskChapter[]),
          listActiveTaskBudgetActivities().catch(() => [] as TaskBudgetActivity[]),
          getObraFulfillment(id).catch(() => null),
          listTaskRemovals(id).catch(() => ({ removals: [] as TaskRemoval[] })),
          listAllObraTasks(id),
        ])
      setObraName(obra.name)
      setChapters(chapterRows)
      setBudgetActivities(budgetRows)
      setFulfillment(fulfillmentData)
      setRemovals(removalData.removals)
      setTasks(taskRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las actividades')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const columns = useMemo(
    () => buildColumns(chapters, tasks, fulfillment),
    [chapters, tasks, fulfillment],
  )

  const subchapterOptions = useMemo(() => {
    const fromCatalog = budgetActivities.filter(
      (activity) => !chapterId || String(activity.chapterId) === chapterId,
    )
    const known = new Set(fromCatalog.map((activity) => activity.id))
    const extras = tasks
      .filter((task) => {
        if (task.budgetActivityId == null || known.has(task.budgetActivityId)) return false
        return !chapterId || String(task.chapterId ?? '') === chapterId
      })
      .map((task) => ({
        id: task.budgetActivityId as number,
        name: task.budgetActivityName || `Subcapítulo ${task.budgetActivityId}`,
      }))
    const uniqueExtras = extras.filter(
      (item, index) => extras.findIndex((other) => other.id === item.id) === index,
    )
    return [...fromCatalog, ...uniqueExtras].sort((a, b) =>
      a.name.localeCompare(b.name, 'es'),
    )
  }, [budgetActivities, tasks, chapterId])

  const visibleColumns = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es')
    return columns
      .filter((column) => !chapterId || column.key === chapterId)
      .map((column) => ({
        ...column,
        tasks: column.tasks.filter((task) => {
          if (budgetActivityId && String(task.budgetActivityId ?? '') !== budgetActivityId) {
            return false
          }
          if (!needle) return true
          const haystack = [task.name, task.budgetActivityName, task.zoneName]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase('es')
          return haystack.includes(needle)
        }),
      }))
      .filter(
        (column) =>
          Boolean(chapterId) || (!budgetActivityId && !needle) || column.tasks.length > 0,
      )
  }, [columns, chapterId, budgetActivityId, query])

  async function confirmRemove() {
    if (!pending) return
    setRemoving(true)
    try {
      await deleteTask(pending.id)
      toast.success('Actividad quitada de esta obra')
      setPending(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo quitar')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={styles.back}
        onClick={() => navigate(`/dashboard/obras/${id}`)}
      >
        ← Volver a la obra
      </button>

      <header className={styles.boardHead}>
        <div>
          <h1 className={styles.title}>Tablero de Actividades</h1>
          <p className={styles.subtitle}>
            {obraName
              ? `${obraName}. Cada columna es un capítulo.`
              : 'Cada columna es un capítulo.'}
          </p>
        </div>
        <div className={styles.filters}>
          <TextSelect
            className={styles.filterSelect}
            aria-label="Capítulo"
            value={chapterId}
            onChange={(event) => {
              setChapterId(event.target.value)
              setBudgetActivityId('')
            }}
          >
            <option value="">Todos los capítulos</option>
            {sortChapters(chapters).map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name}
              </option>
            ))}
          </TextSelect>
          <TextSelect
            className={styles.filterSelect}
            aria-label="Subcapítulo"
            value={budgetActivityId}
            onChange={(event) => setBudgetActivityId(event.target.value)}
          >
            <option value="">Todos los subcapítulos</option>
            {subchapterOptions.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </TextSelect>
          <input
            className={styles.search}
            type="search"
            value={query}
            placeholder="Buscar actividad..."
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </header>

      <section className={styles.banner}>
        <div>
          <h2 className={styles.bannerTitle}>¿Necesitas agregar una actividad?</h2>
          <p className={styles.bannerText}>
            Puedes tomarla del listado general o crear una solo para esta obra.
          </p>
        </div>
        <div className={styles.bannerActions}>
          <Button variant="ghost" onClick={() => setOrigin('pool')}>
            Del listado
          </Button>
          <Button onClick={() => setOrigin('obra')}>Agregar actividad</Button>
        </div>
      </section>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando actividades…</p>
      ) : visibleColumns.length === 0 ? (
        <p className={styles.empty}>No hay actividades con ese filtro.</p>
      ) : (
        <div className={styles.board}>
          {visibleColumns.map((column) => {
            const accent = accentFor(column.name)
            const open = expanded[column.key] === true
            const shown = open ? column.tasks : column.tasks.slice(0, 4)
            const hidden = column.tasks.length - shown.length
            return (
              <section key={column.key} className={styles.column}>
                <header className={styles.columnHeader}>
                  <span className={styles.columnMark} style={{ color: accent.ink, background: accent.soft }}>
                    <ChapterGlyph />
                  </span>
                  <h2 className={styles.columnTitle}>{column.name}</h2>
                  <span className={styles.count} style={{ color: accent.ink, background: accent.soft }}>
                    {column.tasks.length}
                  </span>
                </header>
                <div className={styles.cards}>
                  {column.tasks.length === 0 ? (
                    <p className={styles.columnEmpty}>Sin actividades en este capítulo.</p>
                  ) : (
                    shown.map((task) => {
                      const progress = asPercent(task.progressPercent)
                      return (
                        <article key={task.id} className={styles.card}>
                          <button
                            type="button"
                            className={styles.cardOpen}
                            onClick={() => setDetailId(task.id)}
                          >
                            <span
                              className={styles.cardIcon}
                              style={{ color: accent.ink, background: accent.soft }}
                            >
                              <ChapterGlyph />
                            </span>
                            <span className={styles.cardBody}>
                              <h3 className={styles.cardTitle}>{task.name}</h3>
                              <p className={styles.cardMeta}>
                                {task.budgetActivityName || 'Sin subcapítulo'}
                                {' · '}
                                {task.zoneName || 'Sin zona'}
                              </p>
                              <span className={styles.meterRow}>
                                <strong style={{ color: progress > 0 ? accent.ink : '#94a3b8' }}>
                                  {progress}%
                                </strong>
                                <span className={styles.meter}>
                                  <span
                                    className={styles.meterFill}
                                    style={{
                                      width: `${progress}%`,
                                      background: progress > 0 ? accent.bar : '#e2e8f0',
                                    }}
                                  />
                                </span>
                              </span>
                            </span>
                          </button>
                          {canRemove && task.status === 'scheduled' ? (
                            <button
                              type="button"
                              className={styles.remove}
                              onClick={() => setPending(task)}
                            >
                              Quitar de esta obra
                            </button>
                          ) : null}
                        </article>
                      )
                    })
                  )}
                </div>
                {column.tasks.length > 4 ? (
                  <button
                    type="button"
                    className={styles.more}
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

      <section className={styles.log}>
        <h2 className={styles.logTitle}>Quitadas de esta obra</h2>
        {removals.length === 0 ? (
          <p className={styles.columnEmpty}>Todavía no se ha quitado ninguna.</p>
        ) : (
          <ul className={styles.logList}>
            {removals.map((item) => (
              <li key={item.id}>
                <strong>{item.taskName}</strong>
                <span>{item.detail}</span>
                <span>
                  {item.removedByName || `Usuario #${item.removedBy}`} ·{' '}
                  {formatDateTime(item.removedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {origin ? (
        <ObraActivityModal
          open
          obraId={id}
          origin={origin}
          onClose={() => setOrigin(null)}
          onCreated={() => void load()}
        />
      ) : null}

      <TaskDetailDrawer
        taskId={detailId}
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        onChanged={() => void load()}
      />

      <Modal
        title="Quitar actividad"
        open={pending !== null}
        onClose={() => {
          if (!removing) setPending(null)
        }}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={removing}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void confirmRemove()} disabled={removing}>
              {removing ? 'Quitando…' : 'Sí, quitar'}
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          ¿Quitar «{pending?.name}» de esta obra? No se borra del listado general
          ni de las otras obras. Queda registrado quién la quitó y a qué hora.
        </p>
      </Modal>
    </div>
  )
}

async function listAllObraTasks(obraId: number): Promise<Task[]> {
  const all: Task[] = []
  let page = 1
  let total = 0
  do {
    const data = await listTasks({ obraId, page, parentOnly: true })
    all.push(...data.tasks)
    total = data.pagination.totalItems
    page += 1
  } while (all.length < total && page <= 40)
  return all
}

function buildColumns(
  chapters: TaskChapter[],
  tasks: Task[],
  fulfillment: ObraFulfillment | null,
): Column[] {
  const progressById = new Map<number, number>()
  for (const chapter of fulfillment?.chapters ?? []) {
    if (chapter.chapterId != null) {
      progressById.set(chapter.chapterId, asPercent(chapter.progressPercent))
    }
  }
  const grouped = new Map<number, Task[]>()
  const loose: Task[] = []
  for (const task of tasks) {
    if (task.chapterId == null) {
      loose.push(task)
      continue
    }
    const bucket = grouped.get(task.chapterId) ?? []
    bucket.push(task)
    grouped.set(task.chapterId, bucket)
  }
  const known = new Set(chapters.map((chapter) => chapter.id))
  const columns: Column[] = sortChapters(chapters).map((chapter) => ({
      key: String(chapter.id),
      name: chapter.name,
      progress: progressById.get(chapter.id) ?? 0,
      tasks: (grouped.get(chapter.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, 'es'),
      ),
    }))
  const extras = [...grouped.entries()]
    .filter(([chapterId]) => !known.has(chapterId))
    .sort((left, right) =>
      compareChapterNames(left[1][0]?.chapterName || '', right[1][0]?.chapterName || ''),
    )
  for (const [chapterId, chapterTasks] of extras) {
    const sample = chapterTasks[0]
    columns.push({
      key: `extra-${chapterId}`,
      name: sample?.chapterName || 'Sin capítulo',
      progress: progressById.get(chapterId) ?? 0,
      tasks: [...chapterTasks].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    })
  }
  if (loose.length > 0) {
    columns.push({
      key: 'none',
      name: 'Sin capítulo',
      progress: 0,
      tasks: loose.sort((a, b) => a.name.localeCompare(b.name, 'es')),
    })
  }
  return columns.sort((left, right) => {
    if (left.key === 'none') return 1
    if (right.key === 'none') return -1
    return compareChapterNames(left.name, right.name)
  })
}

function accentFor(name: string): { ink: string; soft: string; bar: string } {
  const palette = [
    { ink: '#1d4ed8', soft: '#e8f1ff', bar: '#2563eb' },
    { ink: '#c2410c', soft: '#fff1e8', bar: '#f97316' },
    { ink: '#a16207', soft: '#fef9c3', bar: '#eab308' },
    { ink: '#0369a1', soft: '#e0f2fe', bar: '#0284c7' },
    { ink: '#475569', soft: '#f1f5f9', bar: '#64748b' },
    { ink: '#15803d', soft: '#e8f7ee', bar: '#16a34a' },
  ]
  return (
    palette[chapterSortRank(name)] ?? {
      ink: '#334155',
      soft: '#f1f5f9',
      bar: '#64748b',
    }
  )
}

function ChapterGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Zm2 1v4h5v-4H6Zm7 0v4h5v-4h-5ZM6 12.5v5h5v-5H6Zm7 0v5h5v-5h-5Z"
      />
    </svg>
  )
}

function asPercent(value: number | string | null | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(100, Math.round(parsed)))
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
