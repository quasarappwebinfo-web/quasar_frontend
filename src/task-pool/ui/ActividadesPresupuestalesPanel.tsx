import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { listActiveTaskChapters } from '@/task-pool/api/capitulosApi'
import { listActiveTaskZones } from '@/task-pool/api/zonasApi'
import {
  createTaskBudgetActivity,
  listTaskBudgetActivities,
  updateTaskBudgetActivity,
} from '@/task-pool/api/actividadesPresupuestalesApi'
import type {
  TaskBudgetActivity,
  TaskChapter,
  TaskZone,
} from '@/task-pool/model/types'
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

export function ActividadesPresupuestalesPanel() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [chapterId, setChapterId] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<TaskBudgetActivity[]>([])
  const [categories, setCategories] = useState<TaskChapter[]>([])
  const [zones, setZones] = useState<TaskZone[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskBudgetActivity | null>(null)
  const [formChapterId, setFormChapterId] = useState('')
  const [formZoneId, setFormZoneId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [chapterWeightPercent, setChapterWeightPercent] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    void listActiveTaskChapters()
      .then(setCategories)
      .catch(() => setCategories([]))
    void listActiveTaskZones()
      .then(setZones)
      .catch(() => setZones([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listTaskBudgetActivities({
        page,
        search: debouncedSearch,
        chapterId: chapterId ? Number(chapterId) : undefined,
        activeOnly: activeOnly || undefined,
      })
      setItems(data.budgetActivities)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar actividades presupuestales',
      )
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, chapterId, activeOnly])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setFormChapterId(
      chapterId || (categories[0] ? String(categories[0].id) : ''),
    )
    setFormZoneId('')
    setName('')
    setDescription('')
    setChapterWeightPercent('')
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item: TaskBudgetActivity) {
    setEditing(item)
    setFormChapterId(item.chapterId ? String(item.chapterId) : '')
    setFormZoneId(item.zoneId ? String(item.zoneId) : '')
    setName(item.name)
    setDescription(item.description || '')
    setChapterWeightPercent(
      item.chapterWeightPercent != null
        ? String(item.chapterWeightPercent)
        : '',
    )
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const catId = Number(formChapterId)
    const zoneIdNum = formZoneId ? Number(formZoneId) : null
    const catWeight = chapterWeightPercent
      ? Number(chapterWeightPercent)
      : null
    if (!name.trim() || Number.isNaN(catId)) {
      setFormError('Capítulo y nombre son obligatorios.')
      return
    }
    if (catWeight != null && (Number.isNaN(catWeight) || catWeight < 0 || catWeight > 100)) {
      setFormError('El % hacia el capítulo debe estar entre 0 y 100.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateTaskBudgetActivity(editing.id, {
          chapterId: catId,
          zoneId: zoneIdNum,
          name: name.trim(),
          description: description.trim() || null,
          chapterWeightPercent: catWeight,
          isActive: editing.isActive,
        })
        toast.success('Actividad presupuestal actualizada')
      } else {
        await createTaskBudgetActivity({
          chapterId: catId,
          zoneId: zoneIdNum,
          name: name.trim(),
          description: description.trim() || null,
          chapterWeightPercent: catWeight,
        })
        toast.success('Actividad presupuestal creada')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('Ese nombre ya existe en el capítulo.')
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: TaskBudgetActivity) {
    try {
      await updateTaskBudgetActivity(item.id, {
        isActive: item.isActive === 1 ? 2 : 1,
      })
      toast.success(
        item.isActive === 1
          ? 'Actividad presupuestal desactivada'
          : 'Actividad presupuestal activada',
      )
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
            <Field label="Buscar" help="Filtra por nombre de actividad.">
              <TextInput
                placeholder="Nombre de actividad"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </Field>
          </div>
          <Field
            label="Capítulo"
            help="Cada actividad presupuestal pertenece a un capítulo."
          >
            <TextSelect
              value={chapterId}
              onChange={(e) => {
                setChapterId(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Todos</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="Estado">
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
        <Button onClick={openCreate}>Nueva actividad</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay actividades presupuestales.</p>
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
                  <span className={styles.metaLabel}>Capítulo</span>
                  <span className={styles.metaValue}>
                    {item.chapterName ||
                      (item.chapterId ? `ID ${item.chapterId}` : 'Sin capítulo')}
                    {item.chapterWeightPercent != null
                      ? ` · ${item.chapterWeightPercent}%`
                      : ''}
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Zona</span>
                  <span className={styles.metaValue}>
                    {item.zoneName ||
                      (item.zoneId ? `ID ${item.zoneId}` : 'Sin zona')}
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Orden</span>
                  <span className={styles.metaValue}>{item.displayOrder}</span>
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
        title={
          editing
            ? 'Editar actividad presupuestal'
            : 'Nueva actividad presupuestal'
        }
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="budget-activity-form"
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form
          id="budget-activity-form"
          className={styles.formGrid}
          onSubmit={handleSubmit}
        >
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field
            label="Capítulo"
            help="La actividad queda ligada a este capítulo (ej. Estructura → Estructura metálica)."
          >
            <TextSelect
              value={formChapterId}
              onChange={(e) => setFormChapterId(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="% hacia el capítulo"
            help="Cuánto aporta esta actividad presupuestal al 100% de su capítulo."
          >
            <TextInput
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={chapterWeightPercent}
              onChange={(e) => setChapterWeightPercent(e.target.value)}
              placeholder="ej. 25"
            />
          </Field>
          <Field
            label="Zona"
            help="Zona a la que contribuye esta actividad presupuestal (opcional)."
          >
            <TextSelect
              value={formZoneId}
              onChange={(e) => setFormZoneId(e.target.value)}
            >
              <option value="">Sin zona</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="Nombre"
            help="Rubro presupuestal concreto (ej. Estructura metálica)."
          >
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Estructura metálica"
              required
            />
          </Field>
          <Field label="Descripción" help="Texto opcional.">
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
