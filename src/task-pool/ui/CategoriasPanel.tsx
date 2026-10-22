import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { listActiveStages } from '@/obras/api/catalogosObrasApi'
import type { StageOption } from '@/obras/model/types'
import {
  createTaskChapter,
  listTaskChapters,
  updateTaskChapter,
} from '@/task-pool/api/capitulosApi'
import type { TaskChapter } from '@/task-pool/model/types'
import { ApiError } from '@/shared/api/apiJson'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import {
  Alert,
  Badge,
  Button,
  Field,
  Modal,
  PaginationBar,
  TextArea,
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
import styles from './taskPool.module.css'

export function CategoriasPanel() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [activeOnly, setActiveOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<TaskChapter[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskChapter | null>(null)
  const [stages, setStages] = useState<StageOption[]>([])
  const [name, setName] = useState('')
  const [stageId, setStageId] = useState('')
  const [description, setDescription] = useState('')
  const [weightPercent, setWeightPercent] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listTaskChapters({
        page,
        search: debouncedSearch,
        activeOnly: activeOnly || undefined,
      })
      setItems(data.chapters)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar capítulos')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, activeOnly])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void listActiveStages()
      .then(setStages)
      .catch(() => setStages([]))
  }, [])

  function openCreate() {
    setEditing(null)
    setName('')
    setStageId('')
    setDescription('')
    setWeightPercent('')
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item: TaskChapter) {
    setEditing(item)
    setName(item.name)
    setStageId(item.stageId != null ? String(item.stageId) : '')
    setDescription(item.description || '')
    setWeightPercent(
      item.weightPercent != null ? String(item.weightPercent) : '',
    )
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const weight = weightPercent.trim() ? Number(weightPercent) : null
    if (!name.trim()) {
      setFormError('El nombre es obligatorio.')
      return
    }
    if (!stageId) {
      setFormError('Elige la etapa a la que pertenece el capítulo.')
      return
    }
    if (weight != null && (Number.isNaN(weight) || weight < 0 || weight > 100)) {
      setFormError('El % debe estar entre 0 y 100.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateTaskChapter(editing.id, {
          name: name.trim(),
          stageId: Number(stageId),
          description: description.trim() || null,
          weightPercent: weight,
          isActive: editing.isActive,
        })
        toast.success('Capítulo actualizado')
      } else {
        await createTaskChapter({
          name: name.trim(),
          stageId: Number(stageId),
          description: description.trim() || null,
          weightPercent: weight,
        })
        toast.success('Capítulo creado')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('Ese nombre de capítulo ya existe.')
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: TaskChapter) {
    try {
      await updateTaskChapter(item.id, {
        isActive: item.isActive === 1 ? 2 : 1,
      })
      toast.success(item.isActive === 1 ? 'Capítulo desactivado' : 'Capítulo activado')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar estado')
    }
  }

  return (
    <section>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <div className={styles.searchGrow}>
            <Field
              label="Buscar"
              help="Filtra capítulos por nombre. La búsqueda se aplica al soltar de escribir."
            >
              <TextInput
                placeholder="Nombre de capítulo"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </Field>
          </div>
          <Field
            label="Estado"
            help="«Solo activos» oculta capítulos desactivados. Útil para limpiar el listado."
          >
            <TextSelect
              value={activeOnly ? '1' : '0'}
              onChange={(e) => {
                setActiveOnly(e.target.value === '1')
                setPage(1)
              }}
            >
              <option value="0">Todos</option>
              <option value="1">Solo activos</option>
            </TextSelect>
          </Field>
        </div>
        <Button onClick={openCreate}>Nuevo capítulo</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay capítulos.</p>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.cardTitle}>{item.name}</h3>
                  <p className={styles.cardSubtitle}>
                    {item.description || `Orden ${item.displayOrder}`}
                  </p>
                </div>
                <Badge tone={item.isActive === 1 ? 'success' : 'danger'}>
                  {item.isActive === 1 ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className={styles.cardMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Orden</span>
                  <span className={styles.metaValue}>{item.displayOrder}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Etapa</span>
                  <span className={styles.metaValue}>{item.stageName || '—'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>% de la etapa</span>
                  <span className={styles.metaValue}>
                    {item.weightPercent != null ? `${item.weightPercent}%` : '—'}
                  </span>
                </div>
              </div>
              <div className={styles.rowActions}>
                <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                  Editar
                </Button>
                <Button
                  variant={item.isActive === 1 ? 'danger' : 'ghost'}
                  size="sm"
                  onClick={() => void toggleActive(item)}
                >
                  {item.isActive === 1 ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <PaginationBar
        page={page}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onChange={setPage}
      />

      <Modal
        title={editing ? 'Editar capítulo' : 'Nuevo capítulo'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="task-category-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="task-category-form" className={styles.formGrid} onSubmit={handleSubmit}>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field
            label="Nombre"
            help="Nombre visible del capítulo (ej. Estructura, Acabados). Debe ser único."
          >
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Etapa"
            help="El capítulo pertenece a una etapa de la obra. Créala primero en la pestaña Etapas."
          >
            <TextSelect
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="% de la etapa"
            help="Opcional. Cuánto aporta este capítulo al 100% de su etapa. El % de la etapa es el que suma hacia la obra."
          >
            <TextInput
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={weightPercent}
              onChange={(e) => setWeightPercent(e.target.value)}
              placeholder="ej. 25"
            />
          </Field>
          <Field
            label="Descripción"
            help="Texto opcional para aclarar qué tipo de actividades agrupa este capítulo."
          >
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>
        </form>
      </Modal>
    </section>
  )
}
