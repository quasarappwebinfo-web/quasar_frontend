import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createWorkPlan,
  listUnfinishedPlanActivities,
} from '@/planificacion/api/planesApi'
import type { UnfinishedPlanActivity } from '@/planificacion/model/types'
import { listTaskBudgetActivities } from '@/task-pool/api/actividadesPresupuestalesApi'
import { listTaskChapters } from '@/task-pool/api/capitulosApi'
import { listTaskTemplates } from '@/task-pool/api/plantillasApi'
import type {
  TaskBudgetActivity,
  TaskChapter,
  TaskTemplate,
} from '@/task-pool/model/types'
import { TASK_STATUS_LABELS } from '@/tareas/model/types'
import type { TaskStatus } from '@/tareas/model/types'
import { listTasks } from '@/tareas/api/tareasApi'
import { formatTaskDate } from '@/tareas/lib/taskUi'
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
import styles from './planificacion.module.css'

type CreatePlanModalProps = {
  open: boolean
  obraId: number
  obraName?: string
  onClose: () => void
  onCreated: (planId: number) => void
}

function statusLabel(status: string): string {
  if (status in TASK_STATUS_LABELS) {
    return TASK_STATUS_LABELS[status as TaskStatus]
  }
  return status
}

async function listEvery<T>(
  load: (page: number) => Promise<{ rows: T[]; total: number }>,
): Promise<T[]> {
  const all: T[] = []
  let page = 1
  let total = 0
  do {
    const data = await load(page)
    all.push(...data.rows)
    total = data.total
    page += 1
  } while (all.length < total && page <= 40)
  return all
}

function defaultWeekRange(): { start: string; end: string } {
  const start = new Date()
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { start: iso(start), end: iso(end) }
}

export function CreatePlanModal({
  open,
  obraId,
  obraName,
  onClose,
  onCreated,
}: CreatePlanModalProps) {
  const toast = useToast()
  const range = useMemo(() => defaultWeekRange(), [])
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(range.start)
  const [endDate, setEndDate] = useState(range.end)
  const [pending, setPending] = useState<UnfinishedPlanActivity[]>([])
  const [chapters, setChapters] = useState<TaskChapter[]>([])
  const [budgetActivities, setBudgetActivities] = useState<TaskBudgetActivity[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [chapterId, setChapterId] = useState('')
  const [budgetActivityId, setBudgetActivityId] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<number[]>([])
  const [selectedTemplates, setSelectedTemplates] = useState<number[]>([])
  const [pickedLabels, setPickedLabels] = useState<Record<number, string>>({})
  const [usedTemplateIds, setUsedTemplateIds] = useState<number[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [loadingPool, setLoadingPool] = useState(false)
  const [poolAlreadyPending, setPoolAlreadyPending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setStep(1)
    setSelectedTasks([])
    setSelectedTemplates([])
    setPickedLabels({})
    setChapterId('')
    setBudgetActivityId('')
    setBudgetActivities([])
    setTemplates([])
    setStartDate(range.start)
    setEndDate(range.end)
    setName(
      obraName
        ? `Plan ${range.start} — ${obraName}`
        : `Plan ${range.start}`,
    )
    setLoadingTasks(true)
    void Promise.all([
      listUnfinishedPlanActivities(obraId).catch(() => ({ tasks: [] })),
      listEvery((page) =>
        listTasks({ obraId, page, parentOnly: true }).then((data) => ({
          rows: data.tasks,
          total: data.pagination.totalItems,
        })),
      ).catch(() => []),
      listEvery((page) =>
        listTaskChapters({ page, activeOnly: true }).then((data) => ({
          rows: data.chapters,
          total: data.pagination.totalItems,
        })),
      ).catch(() => [] as TaskChapter[]),
    ])
      .then(([pendingData, obraTasks, chapterRows]) => {
        setPending(pendingData.tasks)
        setChapters(chapterRows)
        const used = new Set<number>()
        for (const task of obraTasks) {
          if (task.sourceTemplateId != null) used.add(task.sourceTemplateId)
        }
        for (const task of pendingData.tasks) {
          if (task.templateId != null) used.add(task.templateId)
        }
        setUsedTemplateIds([...used])
      })
      .finally(() => setLoadingTasks(false))
  }, [open, obraId, obraName, range.end, range.start])

  useEffect(() => {
    if (!chapterId) {
      setBudgetActivities([])
      setBudgetActivityId('')
      setTemplates([])
      return
    }
    let cancelled = false
    setBudgetActivities([])
    setBudgetActivityId('')
    setTemplates([])
    setLoadingPool(true)
    void listEvery((page) =>
      listTaskBudgetActivities({
        page,
        activeOnly: true,
        chapterId: Number(chapterId),
      }).then((data) => ({
        rows: data.budgetActivities,
        total: data.pagination.totalItems,
      })),
    )
      .then((rows) => {
        if (!cancelled) setBudgetActivities(rows)
      })
      .catch(() => {
        if (!cancelled) setBudgetActivities([])
      })
      .finally(() => {
        if (!cancelled) setLoadingPool(false)
      })
    return () => {
      cancelled = true
    }
  }, [chapterId])

  useEffect(() => {
    if (!budgetActivityId) {
      setTemplates([])
      setPoolAlreadyPending(false)
      return
    }
    let cancelled = false
    setLoadingPool(true)
    setPoolAlreadyPending(false)
    void listEvery((page) =>
      listTaskTemplates({
        page,
        activeOnly: true,
        chapterId: chapterId ? Number(chapterId) : undefined,
        budgetActivityId: Number(budgetActivityId),
      }).then((data) => ({
        rows: data.templates,
        total: data.pagination.totalItems,
      })),
    )
      .then((rows) => {
        if (!cancelled) {
          const visible = rows.filter((item) => !usedTemplateIds.includes(item.id))
          setTemplates(visible)
          setPoolAlreadyPending(rows.length > 0 && visible.length === 0)
        }
      })
      .catch(() => {
        if (!cancelled) setTemplates([])
      })
      .finally(() => {
        if (!cancelled) setLoadingPool(false)
      })
    return () => {
      cancelled = true
    }
  }, [budgetActivityId, chapterId, usedTemplateIds])

  const selectedCount = selectedTasks.length + selectedTemplates.length

  function toggleTemplate(item: TaskTemplate) {
    const label = `${item.code} — ${item.name}`
    setSelectedTemplates((current) =>
      current.includes(item.id)
        ? current.filter((id) => id !== item.id)
        : [...current, item.id],
    )
    setPickedLabels((current) => {
      if (current[item.id]) {
        const next = { ...current }
        delete next[item.id]
        return next
      }
      return { ...current, [item.id]: label }
    })
  }

  function toggleId(
    current: number[],
    id: number,
    setter: (next: number[]) => void,
  ) {
    setter(
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }

  function goToActivities(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || !startDate || !endDate) {
      setError('Nombre y periodo (inicio/fin) son obligatorios.')
      return
    }
    if (endDate < startDate) {
      setError('La fecha fin debe ser posterior al inicio.')
      return
    }
    setError(null)
    setStep(2)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (selectedCount === 0) {
      setError('Selecciona al menos una actividad para este periodo.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const plan = await createWorkPlan({
        obraId,
        name: name.trim(),
        startDate,
        endDate,
        taskIds: selectedTasks,
        templateIds: selectedTemplates,
      })
      toast.success('Plan creado (borrador v1)')
      onCreated(plan.id)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el plan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={
        step === 1
          ? 'Nueva planificación · Periodo'
          : 'Nueva planificación · Actividades'
      }
      open={open}
      onClose={onClose}
      wide
      footer={
        step === 1 ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form="create-work-plan-step1">
              Continuar: elegir actividades
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
              ← Periodo
            </Button>
            <Button type="submit" form="create-work-plan-step2" disabled={saving}>
              {saving ? 'Creando…' : 'Crear borrador'}
            </Button>
          </>
        )
      }
    >
      {error ? <Alert tone="error">{error}</Alert> : null}

      {step === 1 ? (
        <form
          id="create-work-plan-step1"
          className={styles.formGrid}
          onSubmit={goToActivities}
        >
          <div className={styles.noteBox}>
            <strong>Paso 1 · Periodo de trabajo.</strong> Define el intervalo
            (semana, quincena, etc.). Después registras las actividades de ese
            periodo, sin versión ni rendimiento.
          </div>
          <Field label="Nombre del plan">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <div className={styles.twoCol}>
            <Field label="Inicio del periodo">
              <TextInput
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Fin del periodo">
              <TextInput
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </Field>
          </div>
        </form>
      ) : (
        <form
          id="create-work-plan-step2"
          className={styles.formGrid}
          onSubmit={handleSubmit}
        >
          <div className={styles.noteBox}>
            <strong>Paso 2 · Actividades.</strong> Periodo {startDate} → {endDate}.
            Registrar una actividad no pide versión, cantidad ni rendimiento.
            Las que quedaron sin completar se pueden traer a estas fechas.
          </div>
          {loadingTasks ? (
            <p className={styles.muted}>Cargando actividades…</p>
          ) : (
            <>
              <p className={styles.groupLabel}>
                Quedaron sin completar ({selectedTasks.length} seleccionadas)
              </p>
              {pending.length === 0 ? (
                <p className={styles.muted}>
                  En periodos anteriores no hay actividades pendientes.
                </p>
              ) : (
                <div className={styles.taskPick}>
                  {pending.map((task) => (
                    <label key={task.id} className={styles.taskOption}>
                      <input
                        type="checkbox"
                        checked={selectedTasks.includes(task.id)}
                        onChange={() =>
                          toggleId(selectedTasks, task.id, setSelectedTasks)
                        }
                      />
                      <span className={styles.taskOptionBody}>
                        <span className={styles.taskOptionName}>{task.name}</span>
                        <span className={styles.taskOptionMeta}>
                          {statusLabel(task.status)}
                          {task.sourcePlanName
                            ? ` · venía de ${task.sourcePlanName}`
                            : ''}
                          {task.plannedEndDate
                            ? ` · hasta ${formatTaskDate(task.plannedEndDate)}`
                            : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p className={styles.groupLabel}>
                Registrar en este periodo ({selectedTemplates.length}{' '}
                seleccionadas)
              </p>
              <div className={styles.twoCol}>
                <Field label="Capítulo">
                  <TextSelect
                    value={chapterId}
                    onChange={(e) => setChapterId(e.target.value)}
                  >
                    <option value="">Seleccionar…</option>
                    {chapters.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.stageName ? `${item.stageName} · ` : ''}
                        {item.name}
                      </option>
                    ))}
                  </TextSelect>
                </Field>
                <Field label="Actividad presupuestal">
                  <TextSelect
                    value={budgetActivityId}
                    onChange={(e) => setBudgetActivityId(e.target.value)}
                    disabled={!chapterId || loadingPool}
                  >
                    <option value="">Seleccionar…</option>
                    {budgetActivities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </TextSelect>
                </Field>
              </div>
              {selectedTemplates.length > 0 ? (
                <p className={styles.muted}>
                  Elegidas:{' '}
                  {selectedTemplates
                    .map((id) => pickedLabels[id] || `#${id}`)
                    .join(' · ')}
                </p>
              ) : null}
              {loadingPool ? (
                <p className={styles.muted}>Cargando actividades del pool…</p>
              ) : !chapterId ? (
                <p className={styles.muted}>
                  Elige un capítulo. Después verás sus actividades presupuestales
                  y, al elegir una, las actividades del pool.
                </p>
              ) : !budgetActivityId ? (
                <p className={styles.muted}>
                  {budgetActivities.length === 0
                    ? 'Este capítulo no tiene actividades presupuestales.'
                    : 'Elige la actividad presupuestal para ver las del pool.'}
                </p>
              ) : templates.length === 0 ? (
                <p className={styles.muted}>
                  {poolAlreadyPending
                    ? 'Esas actividades ya se usaron en esta obra: están planeadas, en progreso o terminadas. No se vuelven a ofrecer.'
                    : 'Esta actividad presupuestal no tiene actividades en el pool.'}
                </p>
              ) : (
                <div className={styles.taskPick}>
                  {templates.map((item) => (
                    <label key={item.id} className={styles.taskOption}>
                      <input
                        type="checkbox"
                        checked={selectedTemplates.includes(item.id)}
                        onChange={() => toggleTemplate(item)}
                      />
                      <span className={styles.taskOptionBody}>
                        <span className={styles.taskOptionName}>{item.name}</span>
                        <span className={styles.taskOptionMeta}>{item.code}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </form>
      )}
    </Modal>
  )
}
