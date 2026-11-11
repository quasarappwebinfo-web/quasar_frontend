import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { listActiveTaskChapters } from '@/task-pool/api/capitulosApi'
import {
  createTaskBudgetActivity,
  listTaskBudgetActivities,
  updateTaskBudgetActivity,
} from '@/task-pool/api/actividadesPresupuestalesApi'
import type {
  TaskBudgetActivity,
  TaskChapter,
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

export function ActividadesPresupuestalesPanel() {
  const toast = useToast()
  const refreshStats = useRefreshCatalogStats()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [chapterId, setChapterId] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<TaskBudgetActivity[]>([])
  const [categories, setCategories] = useState<TaskChapter[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskBudgetActivity | null>(null)
  const [formChapterId, setFormChapterId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    void listActiveTaskChapters()
      .then(setCategories)
      .catch(() => setCategories([]))
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
      refreshStats()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los subcapítulos',
      )
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, chapterId, activeOnly, refreshStats])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setFormChapterId(
      chapterId || (categories[0] ? String(categories[0].id) : ''),
    )
    setName('')
    setDescription('')
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item: TaskBudgetActivity) {
    setEditing(item)
    setFormChapterId(item.chapterId ? String(item.chapterId) : '')
    setName(item.name)
    setDescription(item.description || '')
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const catId = Number(formChapterId)
    if (!name.trim() || Number.isNaN(catId)) {
      setFormError('Capítulo y nombre son obligatorios.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateTaskBudgetActivity(editing.id, {
          chapterId: catId,
          zoneId: null,
          name: name.trim(),
          description: description.trim() || null,
          isActive: editing.isActive,
        })
        toast.success('Subcapítulo actualizado')
      } else {
        await createTaskBudgetActivity({
          chapterId: catId,
          zoneId: null,
          name: name.trim(),
          description: description.trim() || null,
        })
        toast.success('Subcapítulo creado')
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
          ? 'Subcapítulo desactivado'
          : 'Subcapítulo activado',
      )
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar estado')
    }
  }

  useCatalogChrome({
    search,
    placeholder: 'Buscar subcapítulo...',
    onSearch: (value) => {
      setSearch(value)
      setPage(1)
    },
    actionLabel: 'Nuevo subcapítulo',
    onAction: openCreate,
  })

  return (
    <section>
      <div className={styles.filterBar}>
        <label className={styles.filterField}>
          Capítulo
          <select
            value={chapterId}
            onChange={(event) => {
              setChapterId(event.target.value)
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
          Estado
          <select
            value={activeOnly ? '1' : '0'}
            onChange={(event) => {
              setActiveOnly(event.target.value === '1')
              setPage(1)
            }}
          >
            <option value="0">Todos</option>
            <option value="1">Solo activos</option>
          </select>
        </label>
        <button
          type="button"
          className={styles.clearFilters}
          onClick={() => {
            setSearch('')
            setChapterId('')
            setActiveOnly(false)
            setPage(1)
          }}
        >
          Limpiar filtros
        </button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay subcapítulos.</p>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Subcapítulo</th>
                <th>Capítulo</th>
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
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td>{item.chapterName || '—'}</td>
                  <td>{item.description || '—'}</td>
                  <td>
                    <StatusPill active={item.isActive === 1} />
                  </td>
                  <td>
                    <RowMenu
                      items={[
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
        noun="subcapítulos"
        onChange={setPage}
      />

      <Modal
        title={
          editing
            ? 'Editar subcapítulo'
            : 'Nuevo subcapítulo'
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
            help="El subcapítulo queda ligado a este capítulo (ej. Estructura → Estructura metálica)."
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
            label="Nombre"
            help="Nombre del subcapítulo (ej. Estructura metálica)."
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
