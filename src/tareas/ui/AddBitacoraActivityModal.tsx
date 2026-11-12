import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addWorkPlanTask, getWorkPlan } from '@/planificacion/api/planesApi'
import { compareChapterNames } from '@/task-pool/lib/chapterOrder'
import { listTasks } from '@/tareas/api/tareasApi'
import { zoneLabel } from '@/tareas/lib/taskUi'
import type { Task } from '@/tareas/model/types'
import { ApiError } from '@/shared/api/apiJson'
import { Alert, Button, Field, Modal, TextSelect, useToast } from '@/shared/ui'
import styles from './tareas.module.css'

type AddBitacoraActivityModalProps = {
  open: boolean
  obraId: number
  planId: number
  onClose: () => void
  onAdded: () => void
}

type Option = {
  id: string
  name: string
}

const NONE = 'none'

export function AddBitacoraActivityModal({
  open,
  obraId,
  planId,
  onClose,
  onAdded,
}: AddBitacoraActivityModalProps) {
  const toast = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [chapterId, setChapterId] = useState('')
  const [subchapterId, setSubchapterId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [versionId, setVersionId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setChapterId('')
    setSubchapterId('')
    setTaskId('')
    setError(null)
    setLoading(true)
    let cancelled = false
    void Promise.all([
      listEveryTask(obraId),
      getWorkPlan(planId),
    ])
      .then(([obraTasks, plan]) => {
        if (cancelled) return
        const taken = new Set(
          plan.currentVersion?.tasks.map((item) => item.taskId) ?? [],
        )
        setVersionId(plan.currentVersion?.version.id ?? null)
        setTasks(obraTasks.filter((task) => !taken.has(task.id)))
      })
      .catch((err) => {
        if (cancelled) return
        setTasks([])
        setVersionId(null)
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las actividades')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, obraId, planId])

  const chapters = useMemo(() => groupChapters(tasks), [tasks])
  const subchapters = useMemo(
    () => groupSubchapters(tasks.filter((task) => chapterKey(task) === chapterId)),
    [tasks, chapterId],
  )
  const activities = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            chapterKey(task) === chapterId && subchapterKey(task) === subchapterId,
        )
        .sort((left, right) => left.name.localeCompare(right.name, 'es')),
    [tasks, chapterId, subchapterId],
  )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!versionId) {
      setError('Esta bitácora no tiene una versión a la que agregar.')
      return
    }
    if (!taskId) {
      setError('Elige la actividad.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const added = tasks.find((task) => String(task.id) === taskId)
      await addWorkPlanTask(versionId, { taskId: Number(taskId) })
      toast.success(added ? `«${added.name}» quedó en la bitácora.` : 'Actividad agregada.')
      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo agregar la actividad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Agregar a la bitácora"
      description="Una actividad que ya está en esta obra."
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="add-bitacora-activity" disabled={saving || !taskId}>
            {saving ? 'Agregando…' : 'Agregar'}
          </Button>
        </>
      }
    >
      <form id="add-bitacora-activity" className={styles.formGrid} onSubmit={handleSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <p className={styles.noteBox}>
          Sale del listado de la obra, no del listado general. Elige capítulo,
          subcapítulo y actividad. Las que ya están en esta bitácora no aparecen.
        </p>
        {loading ? <p className={styles.hint}>Cargando actividades de la obra…</p> : null}
        {!loading && tasks.length === 0 && !error ? (
          <p className={styles.hint}>
            Esta obra no tiene más actividades fuera de la bitácora.
          </p>
        ) : null}
        <Field label="Capítulo">
          <TextSelect
            value={chapterId}
            disabled={loading || tasks.length === 0}
            onChange={(event) => {
              setChapterId(event.target.value)
              setSubchapterId('')
              setTaskId('')
            }}
          >
            <option value="">Seleccionar…</option>
            {chapters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </TextSelect>
        </Field>
        <Field label="Subcapítulo">
          <TextSelect
            value={subchapterId}
            disabled={!chapterId}
            onChange={(event) => {
              setSubchapterId(event.target.value)
              setTaskId('')
            }}
          >
            <option value="">Seleccionar…</option>
            {subchapters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </TextSelect>
        </Field>
        <Field label="Actividad">
          <TextSelect
            value={taskId}
            disabled={!subchapterId}
            onChange={(event) => setTaskId(event.target.value)}
          >
            <option value="">Seleccionar…</option>
            {activities.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name} · {zoneLabel(task)}
              </option>
            ))}
          </TextSelect>
        </Field>
      </form>
    </Modal>
  )
}

async function listEveryTask(obraId: number): Promise<Task[]> {
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

function chapterKey(task: Task): string {
  return task.chapterId != null ? String(task.chapterId) : NONE
}

function subchapterKey(task: Task): string {
  return task.budgetActivityId != null ? String(task.budgetActivityId) : NONE
}

function groupChapters(tasks: Task[]): Option[] {
  const byId = new Map<string, string>()
  for (const task of tasks) {
    const id = chapterKey(task)
    if (!byId.has(id)) byId.set(id, task.chapterName || 'Sin capítulo')
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => {
      if (left.id === NONE) return 1
      if (right.id === NONE) return -1
      return compareChapterNames(left.name, right.name)
    })
}

function groupSubchapters(tasks: Task[]): Option[] {
  const byId = new Map<string, string>()
  for (const task of tasks) {
    const id = subchapterKey(task)
    if (!byId.has(id)) byId.set(id, task.budgetActivityName || 'Sin subcapítulo')
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => {
      if (left.id === NONE) return 1
      if (right.id === NONE) return -1
      return left.name.localeCompare(right.name, 'es')
    })
}
