import { useEffect, useState, type FormEvent } from 'react'
import { listTaskBudgetActivities } from '@/task-pool/api/actividadesPresupuestalesApi'
import { listTaskChapters } from '@/task-pool/api/capitulosApi'
import { listTaskTemplates } from '@/task-pool/api/plantillasApi'
import type {
  TaskBudgetActivity,
  TaskChapter,
  TaskTemplate,
} from '@/task-pool/model/types'
import { addActivityToPeriod, listTasks } from '@/tareas/api/tareasApi'
import { ApiError } from '@/shared/api/apiJson'
import {
  Alert,
  Button,
  Field,
  Modal,
  TextArea,
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
import styles from './tareas.module.css'

type CreateTaskFromTemplateModalProps = {
  open: boolean
  obraId: number
  onClose: () => void
  onCreated: () => void
}

type Origin = 'pool' | 'obra'

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

export function CreateTaskFromTemplateModal({
  open,
  obraId,
  onClose,
  onCreated,
}: CreateTaskFromTemplateModalProps) {
  const toast = useToast()
  const [origin, setOrigin] = useState<Origin>('pool')
  const [chapters, setChapters] = useState<TaskChapter[]>([])
  const [budgetActivities, setBudgetActivities] = useState<TaskBudgetActivity[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [chapterId, setChapterId] = useState('')
  const [budgetActivityId, setBudgetActivityId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [usedTemplateIds, setUsedTemplateIds] = useState<number[]>([])
  const [poolAlreadyUsed, setPoolAlreadyUsed] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [justification, setJustification] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setOrigin('pool')
    setChapterId('')
    setBudgetActivityId('')
    setBudgetActivities([])
    setTemplates([])
    setTemplateId('')
    setUsedTemplateIds([])
    setPoolAlreadyUsed(false)
    setName('')
    setDescription('')
    setJustification('')
    setError(null)
    void Promise.all([
      listEvery((page) =>
        listTaskChapters({ page, activeOnly: true }).then((data) => ({
          rows: data.chapters,
          total: data.pagination.totalItems,
        })),
      ).catch(() => [] as TaskChapter[]),
      listEvery((page) =>
        listTasks({ obraId, page, parentOnly: true }).then((data) => ({
          rows: data.tasks,
          total: data.pagination.totalItems,
        })),
      ).catch(() => []),
    ]).then(([chapterRows, obraTasks]) => {
      setChapters(chapterRows)
      setUsedTemplateIds(
        obraTasks
          .map((task) => task.sourceTemplateId)
          .filter((id): id is number => id != null),
      )
    })
  }, [open, obraId])

  useEffect(() => {
    if (!open || !chapterId) {
      setBudgetActivities([])
      setBudgetActivityId('')
      setTemplates([])
      setTemplateId('')
      return
    }
    let cancelled = false
    setBudgetActivities([])
    setBudgetActivityId('')
    setTemplates([])
    setTemplateId('')
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
    return () => {
      cancelled = true
    }
  }, [open, chapterId])

  useEffect(() => {
    if (!open || !budgetActivityId) {
      setTemplates([])
      setTemplateId('')
      setPoolAlreadyUsed(false)
      return
    }
    let cancelled = false
    setTemplateId('')
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
          setPoolAlreadyUsed(rows.length > 0 && visible.length === 0)
        }
      })
      .catch(() => {
        if (!cancelled) setTemplates([])
      })
    return () => {
      cancelled = true
    }
  }, [open, budgetActivityId, chapterId, usedTemplateIds])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (justification.trim().length < 8) {
      setError('Escribe por qué se agrega esta actividad.')
      return
    }
    if (origin === 'pool' && !templateId) {
      setError('Selecciona la actividad del pool.')
      return
    }
    if (origin === 'obra' && !name.trim()) {
      setError('El nombre es obligatorio para una actividad de esta obra.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await addActivityToPeriod({
        obraId,
        templateId: origin === 'pool' ? Number(templateId) : null,
        name: name.trim() || null,
        description: description.trim() || null,
        justification: justification.trim(),
      })
      toast.success(
        `«${result.task.name}» quedó en el periodo. Los administradores deben firmar de nuevo.`,
      )
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la actividad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Nueva actividad"
      open={open}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="create-task-template" disabled={saving}>
            {saving ? 'Guardando…' : 'Agregar y pedir firma'}
          </Button>
        </>
      }
    >
      <form id="create-task-template" className={styles.formGrid} onSubmit={handleSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className={styles.noteBox}>
          Puede salir del pool, sin versión ni rendimiento, o ser única de esta
          obra. Al guardarla se avisa a los administradores, queda la
          justificación y el plan del periodo vuelve a pedir firma.
        </div>
        <Field label="Origen">
          <TextSelect
            value={origin}
            onChange={(e) => setOrigin(e.target.value as Origin)}
          >
            <option value="pool">Del pool de actividades</option>
            <option value="obra">Solo esta obra</option>
          </TextSelect>
        </Field>
        {origin === 'pool' ? (
          <>
          <Field label="Capítulo">
            <TextSelect
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              required
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
              required
              disabled={!chapterId}
            >
              <option value="">Seleccionar…</option>
              {budgetActivities.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="Actividad del pool"
            help={
              poolAlreadyUsed
                ? 'Esas actividades ya se usaron en esta obra (planeadas, en progreso o terminadas).'
                : 'Solo las que esta obra todavía no ha usado. No se pide versión ni rendimiento.'
            }
          >
            <TextSelect
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              required
              disabled={!budgetActivityId}
            >
              <option value="">Seleccionar…</option>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          </>
        ) : (
          <>
            <Field
              label="Nombre"
              help="Esta actividad no se guarda en el pool. Solo existe en esta obra."
            >
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field label="Descripción">
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
          </>
        )}
        <Field
          label="Justificación"
          help="Queda guardada en el plan. Ejemplo: se añadió porque el cliente pidió el muro de contención."
        >
          <TextArea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={4}
            required
          />
        </Field>
      </form>
    </Modal>
  )
}
