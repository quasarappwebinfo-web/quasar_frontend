import { useEffect, useState, type FormEvent } from 'react'
import { listTaskBudgetActivities } from '@/task-pool/api/actividadesPresupuestalesApi'
import { listTaskChapters } from '@/task-pool/api/capitulosApi'
import { listTaskTemplates } from '@/task-pool/api/plantillasApi'
import { listTaskZones } from '@/task-pool/api/zonasApi'
import type {
  TaskBudgetActivity,
  TaskChapter,
  TaskTemplate,
  TaskZone,
} from '@/task-pool/model/types'
import { createTask, createTaskFromTemplate, listTasks } from '@/tareas/api/tareasApi'
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
import styles from '@/tareas/ui/tareas.module.css'

type Origin = 'pool' | 'obra'

type ObraActivityModalProps = {
  open: boolean
  obraId: number
  origin: Origin
  onClose: () => void
  onCreated: () => void
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

export function ObraActivityModal({
  open,
  obraId,
  origin,
  onClose,
  onCreated,
}: ObraActivityModalProps) {
  const toast = useToast()
  const [chapters, setChapters] = useState<TaskChapter[]>([])
  const [zones, setZones] = useState<TaskZone[]>([])
  const [budgetActivities, setBudgetActivities] = useState<TaskBudgetActivity[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [usedTemplateIds, setUsedTemplateIds] = useState<number[]>([])
  const [chapterId, setChapterId] = useState('')
  const [budgetActivityId, setBudgetActivityId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setChapterId('')
    setBudgetActivityId('')
    setZoneId('')
    setTemplateId('')
    setName('')
    setDescription('')
    setError(null)
    void Promise.all([
      listEvery((page) =>
        listTaskChapters({ page, activeOnly: true }).then((data) => ({
          rows: data.chapters,
          total: data.pagination.totalItems,
        })),
      ).catch(() => [] as TaskChapter[]),
      listEvery((page) =>
        listTaskZones({ page, activeOnly: true }).then((data) => ({
          rows: data.zones,
          total: data.pagination.totalItems,
        })),
      ).catch(() => [] as TaskZone[]),
      listEvery((page) =>
        listTasks({ obraId, page, parentOnly: true }).then((data) => ({
          rows: data.tasks,
          total: data.pagination.totalItems,
        })),
      ).catch(() => []),
    ]).then(([chapterRows, zoneRows, obraTasks]) => {
      setChapters(chapterRows)
      setZones(zoneRows)
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
      return
    }
    let cancelled = false
    void listEvery((page) =>
      listTaskBudgetActivities({
        page,
        chapterId: Number(chapterId),
        activeOnly: true,
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
    if (!open || origin !== 'pool' || !budgetActivityId) {
      setTemplates([])
      setTemplateId('')
      return
    }
    let cancelled = false
    void listEvery((page) =>
      listTaskTemplates({
        page,
        budgetActivityId: Number(budgetActivityId),
        activeOnly: true,
      }).then((data) => ({
        rows: data.templates,
        total: data.pagination.totalItems,
      })),
    )
      .then((rows) => {
        if (cancelled) return
        setTemplates(rows.filter((item) => !usedTemplateIds.includes(item.id)))
      })
      .catch(() => {
        if (!cancelled) setTemplates([])
      })
    return () => {
      cancelled = true
    }
  }, [open, origin, budgetActivityId, usedTemplateIds])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (origin === 'pool') {
        await createTaskFromTemplate({
          obraId,
          templateId: Number(templateId),
          copySubtasks: false,
          instantiateDependencies: false,
        })
      } else {
        await createTask({
          obraId,
          name: name.trim(),
          description: description.trim() || null,
          chapterId: Number(chapterId),
          budgetActivityId: Number(budgetActivityId),
          zoneId: Number(zoneId),
        })
      }
      toast.success('Actividad agregada a la obra')
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo agregar')
    } finally {
      setSaving(false)
    }
  }

  const title = origin === 'pool' ? 'Agregar del listado' : 'Actividad solo de esta obra'

  return (
    <Modal
      title={title}
      open={open}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="obra-activity" disabled={saving}>
            {saving ? 'Guardando…' : 'Agregar'}
          </Button>
        </>
      }
    >
      <form id="obra-activity" className={styles.formGrid} onSubmit={handleSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Capítulo">
          <TextSelect
            value={chapterId}
            onChange={(e) => {
              setChapterId(e.target.value)
              setBudgetActivityId('')
              setTemplateId('')
            }}
            required
          >
            <option value="">Seleccionar…</option>
            {chapters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.weightPercent != null ? ` · ${item.weightPercent}% de la obra` : ''}
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
        {origin === 'pool' ? (
          <Field
            label="Actividad del listado"
            help="Las que esta obra todavía no tiene. El porcentaje del capítulo se reparte entre todas las de esta casa."
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
                  {item.name}
                </option>
              ))}
            </TextSelect>
          </Field>
        ) : (
          <>
            <Field label="Zona">
              <TextSelect
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                required
              >
                <option value="">Seleccionar…</option>
                {zones.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field
              label="Nombre"
              help="No entra al listado general. Solo existe en esta obra."
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
      </form>
    </Modal>
  )
}
