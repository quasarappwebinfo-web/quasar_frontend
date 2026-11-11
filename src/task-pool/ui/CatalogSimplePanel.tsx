import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { ActiveStatus } from '@/identidad/model/types'
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

export type CatalogItem = {
  id: number
  name: string
  description: string | null
  displayOrder: number
  isActive: ActiveStatus
  weightPercent?: number | string | null
}

type CatalogWrite = {
  name: string
  description?: string | null
  displayOrder?: number
  weightPercent?: number | null
}

type CatalogUpdate = {
  name?: string
  description?: string | null
  displayOrder?: number
  weightPercent?: number | null
  isActive?: ActiveStatus
}

type CatalogSimplePanelProps = {
  singular: string
  plural: string
  nameExample: string
  nameHelp: string
  weightLabel?: string
  weightHelp?: string
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
  weightLabel,
  weightHelp,
  listItems,
  createItem,
  updateItem,
}: CatalogSimplePanelProps) {
  const toast = useToast()
  const refreshStats = useRefreshCatalogStats()
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
  const [weightPercent, setWeightPercent] = useState('')
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
      refreshStats()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `No se pudieron cargar ${plural}`,
      )
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, activeOnly, listItems, plural, refreshStats])

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

  function openEdit(item: CatalogItem) {
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
    if (!name.trim()) {
      setFormError('El nombre es obligatorio.')
      return
    }
    const weight = weightPercent.trim() ? Number(weightPercent) : null
    if (
      weightLabel &&
      weight != null &&
      (Number.isNaN(weight) || weight < 0 || weight > 100)
    ) {
      setFormError('El % debe estar entre 0 y 100.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateItem(editing.id, {
          name: name.trim(),
          description: description.trim() || null,
          ...(weightLabel ? { weightPercent: weight } : {}),
          isActive: editing.isActive,
        })
        toast.success(`${singular} actualizada`)
      } else {
        await createItem({
          name: name.trim(),
          description: description.trim() || null,
          ...(weightLabel ? { weightPercent: weight } : {}),
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

  useCatalogChrome({
    search,
    placeholder: `Buscar ${singular.toLowerCase()}...`,
    onSearch: (value) => {
      setSearch(value)
      setPage(1)
    },
    actionLabel: `Nueva ${singular.toLowerCase()}`,
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
            <option value="1">Solo activas</option>
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
        <p className={styles.empty}>No hay {plural.toLowerCase()}.</p>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{singular}</th>
                {weightLabel ? <th>{weightLabel}</th> : null}
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
                  {weightLabel ? (
                    <td>
                      {item.weightPercent != null ? `${item.weightPercent}%` : '—'}
                    </td>
                  ) : null}
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
        noun={plural.toLowerCase()}
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
          {weightLabel ? (
            <Field label={weightLabel} help={weightHelp}>
              <TextInput
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={weightPercent}
                onChange={(event) => setWeightPercent(event.target.value)}
                placeholder="ej. 70"
              />
            </Field>
          ) : null}
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
