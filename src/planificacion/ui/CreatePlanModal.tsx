import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createWorkPlan } from '@/planificacion/api/planesApi'
import { listTasks } from '@/tareas/api/tareasApi'
import type { Task } from '@/tareas/model/types'
import { formatTaskDate } from '@/tareas/lib/taskUi'
import { ApiError } from '@/shared/api/apiJson'
import {
  Alert,
  Button,
  Field,
  Modal,
  TextInput,
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
  const [tasks, setTasks] = useState<Task[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setStep(1)
    setSelected([])
    setStartDate(range.start)
    setEndDate(range.end)
    setName(
      obraName
        ? `Plan ${range.start} — ${obraName}`
        : `Plan ${range.start}`,
    )
    setLoadingTasks(true)
    void listTasks({ obraId, page: 1, parentOnly: true })
      .then((data) => setTasks(data.tasks))
      .catch(() => setTasks([]))
      .finally(() => setLoadingTasks(false))
  }, [open, obraId, obraName, range.end, range.start])

  const eligible = useMemo(
    () =>
      tasks.filter((task) => Boolean(task.plannedStartDate && task.plannedEndDate)),
    [tasks],
  )
  const ineligible = tasks.length - eligible.length

  function toggleTask(taskId: number) {
    setSelected((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
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
    if (selected.length === 0) {
      setError('Selecciona al menos una actividad con fechas planificadas.')
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
        taskIds: selected,
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
            (semana, quincena, etc.). Después elegirás qué actividades ejecutar
            en ese periodo.
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
            <strong>Paso 2 · Actividades.</strong> Periodo{' '}
            {startDate} → {endDate}. Selecciona las actividades programadas que
            entran en este plan (deben tener fechas planificadas).
          </div>
          <Field
            label={`Actividades a ejecutar (${selected.length} seleccionadas)`}
            help="Solo aparecen actividades con fechas planificadas."
          >
            {loadingTasks ? (
              <p className={styles.muted}>Cargando actividades…</p>
            ) : eligible.length === 0 ? (
              <p className={styles.muted}>
                No hay actividades elegibles en esta obra.
                {ineligible > 0
                  ? ` (${ineligible} sin fechas planificadas)`
                  : ''}
              </p>
            ) : (
              <div className={styles.taskPick}>
                {eligible.map((task) => (
                  <label key={task.id} className={styles.taskOption}>
                    <input
                      type="checkbox"
                      checked={selected.includes(task.id)}
                      onChange={() => toggleTask(task.id)}
                    />
                    <span className={styles.taskOptionBody}>
                      <span className={styles.taskOptionName}>{task.name}</span>
                      <span className={styles.taskOptionMeta}>
                        {formatTaskDate(task.plannedStartDate)} →{' '}
                        {formatTaskDate(task.plannedEndDate)}
                        {task.status ? ` · ${task.status}` : ''}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </Field>
          {ineligible > 0 ? (
            <p className={styles.muted}>
              {ineligible} actividad(es) ocultas por no tener fechas planificadas.
            </p>
          ) : null}
        </form>
      )}
    </Modal>
  )
}
