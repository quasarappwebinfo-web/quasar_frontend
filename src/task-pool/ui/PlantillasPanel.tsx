import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { listActiveTaskCategories } from '@/task-pool/api/categoriasApi'
import { listActiveTaskZones } from '@/task-pool/api/zonasApi'
import { listActiveTaskBudgetActivities } from '@/task-pool/api/actividadesPresupuestalesApi'
import {
  createTaskTemplate,
  listTaskTemplates,
  updateTaskTemplate,
} from '@/task-pool/api/plantillasApi'
import type {
  TaskBudgetActivity,
  TaskCategory,
  TaskTemplate,
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

export function PlantillasPanel() {
  const toast = useToast()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [categoryId, setCategoryId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [budgetActivityId, setBudgetActivityId] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<TaskTemplate[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [zones, setZones] = useState<TaskZone[]>([])
  const [budgetActivities, setBudgetActivities] = useState<TaskBudgetActivity[]>(
    [],
  )
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskTemplate | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formZoneId, setFormZoneId] = useState('')
  const [formBudgetActivityId, setFormBudgetActivityId] = useState('')
  const [description, setDescription] = useState('')
  const [budgetWeightPercent, setBudgetWeightPercent] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    void listActiveTaskCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
    void listActiveTaskZones()
      .then(setZones)
      .catch(() => setZones([]))
    void listActiveTaskBudgetActivities()
      .then(setBudgetActivities)
      .catch(() => setBudgetActivities([]))
  }, [])

  const filterBudgetActivities = useMemo(() => {
    if (!categoryId) return budgetActivities
    const cat = Number(categoryId)
    return budgetActivities.filter((a) => a.categoryId === cat)
  }, [budgetActivities, categoryId])

  const formBudgetActivities = useMemo(() => {
    if (!formCategoryId) return []
    const cat = Number(formCategoryId)
    return budgetActivities.filter((a) => a.categoryId === cat)
  }, [budgetActivities, formCategoryId])

  useEffect(() => {
    if (!formBudgetActivityId) return
    const stillValid = formBudgetActivities.some(
      (a) => String(a.id) === formBudgetActivityId,
    )
    if (!stillValid) {
      setFormBudgetActivityId(
        formBudgetActivities[0] ? String(formBudgetActivities[0].id) : '',
      )
    }
  }, [formBudgetActivities, formBudgetActivityId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listTaskTemplates({
        page,
        search: debouncedSearch,
        categoryId: categoryId ? Number(categoryId) : undefined,
        zoneId: zoneId ? Number(zoneId) : undefined,
        budgetActivityId: budgetActivityId
          ? Number(budgetActivityId)
          : undefined,
        activeOnly: activeOnly || undefined,
      })
      setItems(data.templates)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar Actividades Registradas')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, categoryId, zoneId, budgetActivityId, activeOnly])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setName('')
    setCode('')
    setFormCategoryId(categoryId || (categories[0] ? String(categories[0].id) : ''))
    setFormZoneId(zoneId || (zones[0] ? String(zones[0].id) : ''))
    const initialCat = Number(
      categoryId || (categories[0] ? String(categories[0].id) : ''),
    )
    const activitiesForCat = budgetActivities.filter(
      (a) => a.categoryId === initialCat,
    )
    setFormBudgetActivityId(
      budgetActivityId &&
        activitiesForCat.some((a) => String(a.id) === budgetActivityId)
        ? budgetActivityId
        : activitiesForCat[0]
          ? String(activitiesForCat[0].id)
          : '',
    )
    setDescription('')
    setBudgetWeightPercent('')
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item: TaskTemplate) {
    setEditing(item)
    setName(item.name)
    setCode(item.code)
    setFormCategoryId(String(item.categoryId))
    setFormZoneId(item.zoneId ? String(item.zoneId) : '')
    setFormBudgetActivityId(
      item.budgetActivityId ? String(item.budgetActivityId) : '',
    )
    setDescription(item.description || '')
    setBudgetWeightPercent(
      item.budgetWeightPercent != null ? String(item.budgetWeightPercent) : '',
    )
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const catId = Number(formCategoryId)
    const zId = Number(formZoneId)
    const baId = Number(formBudgetActivityId)
    const budgetWeight = budgetWeightPercent
      ? Number(budgetWeightPercent)
      : null
    if (
      !name.trim() ||
      (!editing && !code.trim()) ||
      Number.isNaN(catId) ||
      Number.isNaN(zId) ||
      Number.isNaN(baId)
    ) {
      setFormError(
        'Categoría, zona, actividad presupuestal, nombre y código son obligatorios.',
      )
      return
    }
    if (
      budgetWeight != null &&
      (Number.isNaN(budgetWeight) || budgetWeight < 0 || budgetWeight > 100)
    ) {
      setFormError('El % hacia la actividad presupuestal debe estar entre 0 y 100.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateTaskTemplate(editing.id, {
          categoryId: catId,
          zoneId: zId,
          budgetActivityId: baId,
          name: name.trim(),
          description: description.trim() || null,
          budgetWeightPercent: budgetWeight,
          isActive: editing.isActive,
        })
        toast.success('Actividad Registrada actualizada')
      } else {
        await createTaskTemplate({
          categoryId: catId,
          zoneId: zId,
          budgetActivityId: baId,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim() || null,
          budgetWeightPercent: budgetWeight,
        })
        toast.success('Actividad Registrada creada')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('Ese código o nombre ya existe.')
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: TaskTemplate) {
    try {
      await updateTaskTemplate(item.id, {
        isActive: item.isActive === 1 ? 2 : 1,
      })
      toast.success(item.isActive === 1 ? 'Actividad Registrada desactivada' : 'Actividad Registrada activada')
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
              help="Busca Actividades Registradas por nombre o código (ej. EST-LOSA-01)."
            >
              <TextInput
                placeholder="Nombre o código"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </Field>
          </div>
          <Field
            label="Categoría"
            help="Filtra Actividades Registradas que pertenecen a una categoría de la Base Datos Actividades."
          >
            <TextSelect
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                setBudgetActivityId('')
                setPage(1)
              }}
            >
              <option value="">Todas</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="Zona" help="Filtra por zona de la obra.">
            <TextSelect
              value={zoneId}
              onChange={(e) => {
                setZoneId(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Todas</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="Actividad presupuestal"
            help={
              categoryId
                ? 'Solo actividades de la categoría filtrada.'
                : 'Elige una categoría para filtrar actividades, o deja «Todas».'
            }
          >
            <TextSelect
              value={budgetActivityId}
              onChange={(e) => {
                setBudgetActivityId(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Todas</option>
              {filterBudgetActivities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="Estado"
            help="«Solo activos» deja fuera Actividades Registradas desactivadas (no recomendadas para uso nuevo)."
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
        <Button onClick={openCreate}>Nueva Actividad Registrada</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay Actividades Registradas.</p>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.cardTitle}>{item.name}</h3>
                  <p className={styles.cardSubtitle}>{item.code}</p>
                </div>
                <Badge tone={item.isActive === 1 ? 'success' : 'danger'}>
                  {item.isActive === 1 ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className={styles.cardMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Categoría</span>
                  <span className={styles.metaValue}>
                    {item.categoryName || `ID ${item.categoryId}`}
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Zona</span>
                  <span className={styles.metaValue}>
                    {item.zoneName || (item.zoneId ? `ID ${item.zoneId}` : '—')}
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Act. presupuestal</span>
                  <span className={styles.metaValue}>
                    {item.budgetActivityName ||
                      (item.budgetActivityId
                        ? `ID ${item.budgetActivityId}`
                        : '—')}
                    {item.budgetWeightPercent != null
                      ? ` · ${item.budgetWeightPercent}%`
                      : ''}
                  </span>
                </div>
                {item.description ? (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Descripción</span>
                    <span className={styles.metaValue}>{item.description}</span>
                  </div>
                ) : null}
              </div>
              <div className={styles.rowActions}>
                <Button
                  size="sm"
                  onClick={() => navigate(`/maestros/task-pool/plantillas/${item.id}`)}
                >
                  Ver versiones
                </Button>
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
        title={editing ? 'Editar Actividad Registrada' : 'Nueva Actividad Registrada'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="task-template-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="task-template-form" className={styles.formGrid} onSubmit={handleSubmit}>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field
            label="Categoría"
            help="Grupo constructivo amplio (ej. Estructura). Define qué actividades presupuestales puedes elegir."
          >
            <TextSelect
              value={formCategoryId}
              onChange={(e) => {
                setFormCategoryId(e.target.value)
                setFormBudgetActivityId('')
              }}
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
            label="Zona"
            help="Ámbito de la obra (ej. Casa, Zona social)."
          >
            <TextSelect
              value={formZoneId}
              onChange={(e) => setFormZoneId(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="Actividad presupuestal"
            help="Solo se listan actividades de la categoría elegida."
          >
            <TextSelect
              value={formBudgetActivityId}
              onChange={(e) => setFormBudgetActivityId(e.target.value)}
              required
              disabled={!formCategoryId}
            >
              <option value="">
                {formCategoryId
                  ? formBudgetActivities.length === 0
                    ? 'Sin actividades en esta categoría'
                    : 'Seleccionar…'
                  : 'Elige categoría primero'}
              </option>
              {formBudgetActivities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="% hacia la actividad presupuestal"
            help="Cuánto aporta esta Actividad Registrada al 100% de su actividad presupuestal."
          >
            <TextInput
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={budgetWeightPercent}
              onChange={(e) => setBudgetWeightPercent(e.target.value)}
              placeholder="ej. 20"
            />
          </Field>
          <Field
            label="Nombre"
            help="Nombre legible de la Actividad Registrada (ej. Vaciado de losa)."
          >
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Código"
            help="Identificador único e inmutable (ej. EST-LOSA-01). No se puede cambiar al editar."
          >
            <TextInput
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={Boolean(editing)}
              placeholder="EST-LOSA-01"
              required={!editing}
            />
          </Field>
          <Field
            label="Descripción"
            help="Detalle opcional del alcance de la Actividad Registrada. El conocimiento técnico vive en las versiones."
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
