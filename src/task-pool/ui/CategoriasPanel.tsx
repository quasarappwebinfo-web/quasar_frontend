import { useCallback, useEffect, useState, type FormEvent } from 'react'
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
  Button,
  Field,
  Modal,
  TextArea,
  TextInput,
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

export function CategoriasPanel() {
  const toast = useToast()
  const refreshStats = useRefreshCatalogStats()
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
  const [name, setName] = useState('')
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
      refreshStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar capítulos')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, activeOnly, refreshStats])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setWeightPercent('')
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item: TaskChapter) {
    setEditing(item)
    setName(item.name)
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
          stageId: null,
          description: description.trim() || null,
          weightPercent: weight,
          isActive: editing.isActive,
        })
        toast.success('Capítulo actualizado')
      } else {
        await createTaskChapter({
          name: name.trim(),
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

  useCatalogChrome({
    search,
    placeholder: 'Buscar capítulo...',
    onSearch: (value) => {
      setSearch(value)
      setPage(1)
    },
    actionLabel: 'Nuevo capítulo',
    onAction: openCreate,
  })

  return (
    <section>
      <div className={styles.filterBar}>
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
        <p className={styles.empty}>No hay capítulos.</p>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Capítulo</th>
                <th>% de cada zona</th>
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
                      <ActivityMark name={item.name} />
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td>{item.weightPercent != null ? `${item.weightPercent}%` : '—'}</td>
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
        noun="capítulos"
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
            label="% de cada zona"
            help="Cuánto vale este capítulo dentro de cada zona. Estructura al 30 % es el 30 % de la Casa y el 30 % de la Zona social."
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
