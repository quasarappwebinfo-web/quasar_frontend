import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { hasPermission, useAuth } from '@/auth'
import { getObra } from '@/obras/api/obrasApi'
import { ObraActivityModal } from '@/obras/ui/ObraActivityModal'
import { listActiveTaskBudgetActivities } from '@/task-pool/api/actividadesPresupuestalesApi'
import { listActiveTaskChapters } from '@/task-pool/api/capitulosApi'
import type { TaskBudgetActivity, TaskChapter } from '@/task-pool/model/types'
import {
  deleteTask,
  getObraFulfillment,
  listTaskRemovals,
  listTasks,
  type TaskRemoval,
} from '@/tareas/api/tareasApi'
import type { ObraFulfillment, Task, TaskStatus } from '@/tareas/model/types'
import { TaskDetailDrawer } from '@/tareas/ui/TaskDetailDrawer'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { Alert, Button, Field, Modal, TextSelect, useToast } from '@/shared/ui'
import styles from './ObraActivities.module.css'

type Column = {
  key: string
  name: string
  progress: number
  tasks: Task[]
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  scheduled: 'Sin iniciar',
  in_progress: 'En progreso',
  completed: 'Completada',
  verified: 'Verificada',
  rescheduled: 'Reprogramada',
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
    return columns
      .filter((column) => !chapterId || column.key === chapterId)
      .map((column) => ({
        ...column,
        tasks: budgetActivityId
          ? column.tasks.filter(
              (task) => String(task.budgetActivityId ?? '') === budgetActivityId,
            )
          : column.tasks,
      }))
      .filter((column) => chapterId || !budgetActivityId || column.tasks.length > 0)
  }, [columns, chapterId, budgetActivityId])

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
      <header className={styles.header}>
        <div>
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate(`/dashboard/obras/${id}`)}
          >
            ← {obraName || 'Obra'}
          </button>
          <h1 className={styles.title}>Actividades de la obra</h1>
          <p className={styles.subtitle}>
            Cada columna es un capítulo. El porcentaje de la cabecera es el
            avance de ese capítulo en esta obra.
          </p>
        </div>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => setOrigin('pool')}>
            Del listado
          </Button>
          <Button onClick={() => setOrigin('obra')}>Solo esta obra</Button>
        </div>
      </header>

      <div className={styles.filters}>
        <Field label="Capítulo">
          <TextSelect
            value={chapterId}
            onChange={(event) => {
              setChapterId(event.target.value)
              setBudgetActivityId('')
            }}
          >
            <option value="">Todos</option>
            {chapters
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, 'es'))
              .map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
          </TextSelect>
        </Field>
        <Field
          label="Subcapítulo"
          help={
            chapterId
              ? 'Solo subcapítulos de ese capítulo.'
              : 'Elige un capítulo para acotar la lista, o deja «Todos».'
          }
        >
          <TextSelect
            value={budgetActivityId}
            onChange={(event) => setBudgetActivityId(event.target.value)}
          >
            <option value="">Todos</option>
            {subchapterOptions.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </TextSelect>
        </Field>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando actividades…</p>
      ) : visibleColumns.length === 0 ? (
        <p className={styles.empty}>No hay actividades con ese filtro.</p>
      ) : (
        <div className={styles.board}>
          {visibleColumns.map((column) => (
            <section key={column.key} className={styles.column}>
              <header className={styles.columnHeader}>
                <h2 className={styles.columnTitle}>{column.name}</h2>
                <span className={styles.progressBadge}>{column.progress}%</span>
              </header>
              <div className={styles.cards}>
                {column.tasks.length === 0 ? (
                  <p className={styles.columnEmpty}>Sin actividades en este capítulo.</p>
                ) : (
                  column.tasks.map((task) => {
                    const notice = completionNotice(task)
                    const progress = asPercent(task.progressPercent)
                    return (
                      <article key={task.id} className={styles.card}>
                        <button
                          type="button"
                          className={styles.cardOpen}
                          onClick={() => setDetailId(task.id)}
                        >
                          <h3 className={styles.cardTitle}>{task.name}</h3>
                        </button>
                        <div className={styles.chips}>
                          <span className={styles[notice.tone]}>{notice.label}</span>
                          <span className={progressTone(progress)}>{progress}% de avance</span>
                          <span className={styles.chip}>
                            {task.budgetActivityName || 'Sin subcapítulo'}
                          </span>
                          <span className={styles.chipZone}>
                            {task.zoneName || 'Sin zona'}
                          </span>
                        </div>
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
            </section>
          ))}
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
  const columns: Column[] = [...chapters]
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((chapter) => ({
      key: String(chapter.id),
      name: chapter.name,
      progress: progressById.get(chapter.id) ?? 0,
      tasks: (grouped.get(chapter.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, 'es'),
      ),
    }))
  for (const [chapterId, chapterTasks] of grouped) {
    if (known.has(chapterId)) continue
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
  return columns
}

function completionNotice(task: Task): {
  label: string
  tone: 'chipDone' | 'chipProgress' | 'chipIdle'
} {
  if (task.status === 'completed' || task.status === 'verified') {
    return { label: STATUS_LABEL[task.status], tone: 'chipDone' }
  }
  if (task.status === 'in_progress' || task.status === 'rescheduled') {
    return { label: STATUS_LABEL[task.status], tone: 'chipProgress' }
  }
  return { label: 'No completada', tone: 'chipIdle' }
}

function progressTone(progress: number): string {
  if (progress >= 100) return styles.chipDone
  if (progress > 0) return styles.chipProgress
  return styles.chipIdle
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
