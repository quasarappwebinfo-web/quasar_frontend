import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { ActiveStatus } from '@/identidad/model/types'
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

export type CatalogItem = {
  id: number
  name: string
  description: string | null
  displayOrder: number
  isActive: ActiveStatus
}

type CatalogWrite = {
  name: string
  description?: string | null
  displayOrder: number
}

type CatalogUpdate = {
  name?: string
  description?: string | null
  displayOrder?: number
  isActive?: ActiveStatus
}

type CatalogSimplePanelProps = {
  singular: string
  plural: string
  nameExample: string
  nameHelp: string
  listItems: (params: {
    page: number
    search: string
    activeOnly?: boolean
  }) => Promise<{
    items: CatalogItem[]
    totalItems: number
    itemsPerPage: number
  }>
  createItem: (payload: CatalogWrite) => Promise<unknown>
  updateItem: (id: number, payload: CatalogUpdate) => Promise<unknown>
}

export function CatalogSimplePanel({
  singular,
  plural,
  nameExample,
  nameHelp,
  listItems,
  createItem,
  updateItem,
}: CatalogSimplePanelProps) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [activeOnly, setActiveOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [displayOrder, setDisplayOrder] = useState('10')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const formId = `catalog-${singular.replace(/\s+/g, '-').toLowerCase()}-form`

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listItems({
        page,
        search: debouncedSearch,
        activeOnly: activeOnly || undefined,
      })
      setItems(data.items)
      setTotalItems(data.totalItems)
      setItemsPerPage(data.itemsPerPage)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `No se pudieron cargar ${plural}`,
      )
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, activeOnly, listItems, plural])

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

  function openEdit(item: CatalogItem) {
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
        await updateItem(editing.id, {
          name: name.trim(),
          description: description.trim() || null,
          displayOrder: order,
          isActive: editing.isActive,
        })
        toast.success(`${singular} actualizada`)
      } else {
        await createItem({
          name: name.trim(),
          description: description.trim() || null,
          displayOrder: order,
        })
        toast.success(`${singular} creada`)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(`Ese nombre de ${singular.toLowerCase()} ya existe.`)
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: CatalogItem) {
    try {
      await updateItem(item.id, {
        isActive: item.isActive === 1 ? 2 : 1,
      })
      toast.success(
        item.isActive === 1
          ? `${singular} desactivada`
          : `${singular} activada`,
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
            <Field
              label="Buscar"
              help={`Filtra ${plural.toLowerCase()} por nombre.`}
            >
              <TextInput
                placeholder={`Nombre de ${singular.toLowerCase()}`}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </Field>
          </div>
          <Field label="Estado" help="«Solo activos» oculta ítems desactivados.">
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
        <Button onClick={openCreate}>Nueva {singular.toLowerCase()}</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay {plural.toLowerCase()}.</p>
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
        title={editing ? `Editar ${singular.toLowerCase()}` : `Nueva ${singular.toLowerCase()}`}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form={formId} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id={formId} className={styles.formGrid} onSubmit={handleSubmit}>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field label="Nombre" help={nameHelp}>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={nameExample}
              required
            />
          </Field>
          <Field
            label="Orden de visualización"
            help="Menor número aparece primero (ej. 10, 20, 30)."
          >
            <TextInput
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              required
            />
          </Field>
          <Field label="Descripción" help="Texto opcional de aclaración.">
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
