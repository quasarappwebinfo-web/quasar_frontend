import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { listActiveTaskChapters } from '@/task-pool/api/capitulosApi'
import { listActiveTaskZones } from '@/task-pool/api/zonasApi'
import { listActiveTaskBudgetActivities } from '@/task-pool/api/actividadesPresupuestalesApi'
import {
  createTaskTemplate,
  listTaskTemplates,
  updateTaskTemplate,
} from '@/task-pool/api/plantillasApi'
import type {
  TaskBudgetActivity,
  TaskChapter,
  TaskTemplate,
  TaskZone,
} from '@/task-pool/model/types'
import { ApiError } from '@/shared/api/apiJson'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
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
import {
  ActivityMark,
  CatalogPager,
  RowMenu,
  StatusPill,
  useCatalogChrome,
  useRefreshCatalogStats,
} from './CatalogParts'
import styles from './taskPool.module.css'

export function PlantillasPanel() {
  const toast = useToast()
  const navigate = useNavigate()
  const refreshStats = useRefreshCatalogStats()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [chapterId, setChapterId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [budgetActivityId, setBudgetActivityId] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [fixedOnly, setFixedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<TaskTemplate[]>([])
  const [categories, setCategories] = useState<TaskChapter[]>([])
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
  const [formChapterId, setFormChapterId] = useState('')
  const [formZoneId, setFormZoneId] = useState('')
  const [formBudgetActivityId, setFormBudgetActivityId] = useState('')
  const [description, setDescription] = useState('')
  const [isFixed, setIsFixed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    void listActiveTaskChapters()
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
    if (!chapterId) return budgetActivities
    const cat = Number(chapterId)
    return budgetActivities.filter((a) => a.chapterId === cat)
  }, [budgetActivities, chapterId])

  const formBudgetActivities = useMemo(() => {
    if (!formChapterId) return []
    const cat = Number(formChapterId)
    return budgetActivities.filter((a) => a.chapterId === cat)
  }, [budgetActivities, formChapterId])

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
        chapterId: chapterId ? Number(chapterId) : undefined,
        zoneId: zoneId ? Number(zoneId) : undefined,
        budgetActivityId: budgetActivityId
          ? Number(budgetActivityId)
          : undefined,
        activeOnly: activeOnly || undefined,
        fixedOnly: fixedOnly || undefined,
      })
      setItems(data.templates)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
      refreshStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar Actividades Registradas')
    } finally {
      setLoading(false)
    }
  }, [
    page,
    debouncedSearch,
    chapterId,
    zoneId,
    budgetActivityId,
    activeOnly,
    fixedOnly,
    refreshStats,
  ])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setName('')
    setFormChapterId(chapterId || (categories[0] ? String(categories[0].id) : ''))
    setFormZoneId(zoneId || '')
    const initialCat = Number(
      chapterId || (categories[0] ? String(categories[0].id) : ''),
    )
    const activitiesForCat = budgetActivities.filter(
      (a) => a.chapterId === initialCat,
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
    setIsFixed(false)
    setFormError(null)
    setModalOpen(true)
    void listActiveTaskBudgetActivities()
      .then(setBudgetActivities)
      .catch(() => setBudgetActivities([]))
  }

  function openEdit(item: TaskTemplate) {
    setEditing(item)
    setName(item.name)
    setFormChapterId(String(item.chapterId))
    setFormZoneId(item.zoneId ? String(item.zoneId) : '')
    setFormBudgetActivityId(
      item.budgetActivityId ? String(item.budgetActivityId) : '',
    )
    setDescription(item.description || '')
    setIsFixed(item.isFixed === 1)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const catId = Number(formChapterId)
    const zId = formZoneId ? Number(formZoneId) : null
    const baId = Number(formBudgetActivityId)
    if (!name.trim() || Number.isNaN(catId) || Number.isNaN(baId)) {
      setFormError(
        'Capítulo, subcapítulo y nombre son obligatorios.',
      )
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateTaskTemplate(editing.id, {
          chapterId: catId,
          zoneId: zId,
          budgetActivityId: baId,
          name: name.trim(),
          description: description.trim() || null,
          isFixed: isFixed ? 1 : 0,
          isActive: editing.isActive,
        })
        toast.success('Actividad Registrada actualizada')
      } else {
        await createTaskTemplate({
          chapterId: catId,
          zoneId: zId,
          budgetActivityId: baId,
          name: name.trim(),
          description: description.trim() || null,
          isFixed: isFixed ? 1 : 0,
        })
        toast.success('Actividad Registrada creada')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('Ese nombre ya existe.')
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

  useCatalogChrome({
    search,
    placeholder: 'Buscar actividad, capítulo o subcapítulo...',
    onSearch: (value) => {
      setSearch(value)
      setPage(1)
    },
    actionLabel: 'Nueva actividad',
    onAction: openCreate,
  })

  function clearFilters() {
    setSearch('')
    setChapterId('')
    setZoneId('')
    setBudgetActivityId('')
    setActiveOnly(false)
    setFixedOnly(false)
    setPage(1)
  }

  return (
    <section>
      <div className={styles.filterBar}>
        <label className={styles.filterField}>
          Capítulo
          <select
            value={chapterId}
            onChange={(event) => {
              setChapterId(event.target.value)
              setBudgetActivityId('')
              setPage(1)
            }}
          >
            <option value="">Todos</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          Subcapítulo
          <select
            value={budgetActivityId}
            onChange={(event) => {
              setBudgetActivityId(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Todos</option>
            {filterBudgetActivities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          Zona
          <select
            value={zoneId}
            onChange={(event) => {
              setZoneId(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Todas</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          Estado
          <select
            value={activeOnly ? '1' : '0'}
            onChange={(event) => {
              setActiveOnly(event.target.value === '1')
              setPage(1)
            }}
          >
            <option value="0">Todos</option>
            <option value="1">Solo activas</option>
          </select>
        </label>
        <label className={styles.filterField}>
          Fijas
          <select
            value={fixedOnly ? '1' : '0'}
            onChange={(event) => {
              setFixedOnly(event.target.value === '1')
              setPage(1)
            }}
          >
            <option value="0">Todas</option>
            <option value="1">Solo fijas</option>
          </select>
        </label>
        <button type="button" className={styles.clearFilters} onClick={clearFilters}>
          Limpiar filtros
        </button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay actividades.</p>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Capítulo</th>
                <th>Subcapítulo</th>
                <th>Zona</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className={styles.nameCell}>
                      <ActivityMark name={item.chapterName} />
                      <span>
                        {item.name}
                        {item.isFixed === 1 ? <span className={styles.fixedTag}>Fija</span> : null}
                      </span>
                    </div>
                  </td>
                  <td>{item.chapterName || '—'}</td>
                  <td>{item.budgetActivityName || '—'}</td>
                  <td>{item.zoneName || 'Todas las zonas'}</td>
                  <td>{item.description || '—'}</td>
                  <td>
                    <StatusPill active={item.isActive === 1} />
                  </td>
                  <td>
                    <RowMenu
                      items={[
                        {
                          label: 'Ver versiones',
                          onClick: () => navigate(`/maestros/task-pool/plantillas/${item.id}`),
                        },
                        { label: 'Editar', onClick: () => openEdit(item) },
                        {
                          label: item.isActive === 1 ? 'Desactivar' : 'Activar',
                          danger: item.isActive === 1,
                          onClick: () => void toggleActive(item),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CatalogPager
        page={page}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        noun="actividades"
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
            label="Capítulo"
            help="Grupo constructivo amplio (ej. Estructura). Define qué subcapítulos puedes elegir."
          >
            <TextSelect
              value={formChapterId}
              onChange={(e) => {
                setFormChapterId(e.target.value)
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
            label="Subcapítulo"
            help="Solo se listan actividades del capítulo elegido."
          >
            <TextSelect
              value={formBudgetActivityId}
              onChange={(e) => setFormBudgetActivityId(e.target.value)}
              required
              disabled={!formChapterId}
            >
              <option value="">
                {formChapterId
                  ? formBudgetActivities.length === 0
                    ? 'Sin actividades en este capítulo'
                    : 'Seleccionar…'
                  : 'Elige capítulo primero'}
              </option>
              {formBudgetActivities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="Zona"
            help="Si se deja en todas las zonas, el avance de esta actividad suma en cada una."
          >
            <TextSelect
              value={formZoneId}
              onChange={(e) => setFormZoneId(e.target.value)}
            >
              <option value="">Todas las zonas</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </TextSelect>
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
            label="Descripción"
            help="Detalle opcional del alcance de la Actividad Registrada. El conocimiento técnico vive en las versiones."
          >
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={isFixed}
              onChange={(e) => setIsFixed(e.target.checked)}
            />
            <span>
              <strong>Fija</strong>
              <span className={styles.checkHelp}>
                Al crear una obra se copia sola y queda programada. Si no
                aplica en esa obra, se quita ahí. Marcarla o desmarcarla no
                cambia las obras que ya existen.
              </span>
            </span>
          </label>
        </form>
      </Modal>
    </section>
  )
}
