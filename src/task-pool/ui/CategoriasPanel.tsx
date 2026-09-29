import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createTaskCategory,
  listTaskCategories,
  updateTaskCategory,
} from '@/task-pool/api/categoriasApi'
import type { TaskCategory } from '@/task-pool/model/types'
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
  const [items, setItems] = useState<TaskCategory[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskCategory | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [displayOrder, setDisplayOrder] = useState('10')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listTaskCategories({
        page,
        search: debouncedSearch,
        activeOnly: activeOnly || undefined,
      })
      setItems(data.categories)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar categorías')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, activeOnly])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setDisplayOrder('10')
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item: TaskCategory) {
    setEditing(item)
    setName(item.name)
    setDescription(item.description || '')
    setDisplayOrder(String(item.displayOrder))
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const order = Number(displayOrder)
    if (!name.trim() || Number.isNaN(order)) {
      setFormError('Nombre y orden son obligatorios.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateTaskCategory(editing.id, {
          name: name.trim(),
          description: description.trim() || null,
          displayOrder: order,
          isActive: editing.isActive,
        })
        toast.success('Categoría actualizada')
      } else {
        await createTaskCategory({
          name: name.trim(),
          description: description.trim() || null,
          displayOrder: order,
        })
        toast.success('Categoría creada')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('Ese nombre de categoría ya existe.')
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: TaskCategory) {
    try {
      await updateTaskCategory(item.id, {
        isActive: item.isActive === 1 ? 2 : 1,
      })
      toast.success(item.isActive === 1 ? 'Categoría desactivada' : 'Categoría activada')
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
              help="Filtra categorías por nombre. La búsqueda se aplica al soltar de escribir."
            >
              <TextInput
                placeholder="Nombre de categoría"
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
            help="«Solo activos» oculta categorías desactivadas. Útil para limpiar el listado."
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
        <Button onClick={openCreate}>Nueva categoría</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay categorías.</p>
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
        title={editing ? 'Editar categoría' : 'Nueva categoría'}
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
            help="Nombre visible de la categoría (ej. Estructura, Acabados). Debe ser único."
          >
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Orden de visualización"
            help="Número para ordenar categorías en listados (menor = aparece primero). Ej. 10, 20, 30."
          >
            <TextInput
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Descripción"
            help="Texto opcional para aclarar qué tipo de actividades agrupa esta categoría."
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
