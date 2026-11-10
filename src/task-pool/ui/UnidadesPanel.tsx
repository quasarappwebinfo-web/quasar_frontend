import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createMeasurementUnit,
  listMeasurementUnits,
  updateMeasurementUnit,
} from '@/task-pool/api/unidadesMedidaApi'
import type { MeasurementUnit } from '@/task-pool/model/types'
import { ApiError } from '@/shared/api/apiJson'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import {
  Alert,
  Button,
  Field,
  Modal,
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

export function UnidadesPanel() {
  const toast = useToast()
  const refreshStats = useRefreshCatalogStats()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [activeOnly, setActiveOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<MeasurementUnit[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MeasurementUnit | null>(null)
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listMeasurementUnits({
        page,
        search: debouncedSearch,
        activeOnly: activeOnly || undefined,
      })
      setItems(data.measurementUnits)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
      refreshStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar unidades')
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
    setSymbol('')
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item: MeasurementUnit) {
    setEditing(item)
    setName(item.name)
    setSymbol(item.symbol)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || !symbol.trim()) {
      setFormError('Nombre y símbolo son obligatorios.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateMeasurementUnit(editing.id, {
          name: name.trim(),
          symbol: symbol.trim(),
          isActive: editing.isActive,
        })
        toast.success('Unidad actualizada')
      } else {
        await createMeasurementUnit({
          name: name.trim(),
          symbol: symbol.trim(),
        })
        toast.success('Unidad creada')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('Ese nombre o símbolo ya existe.')
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: MeasurementUnit) {
    try {
      await updateMeasurementUnit(item.id, {
        isActive: item.isActive === 1 ? 2 : 1,
      })
      toast.success(item.isActive === 1 ? 'Unidad desactivada' : 'Unidad activada')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar estado')
    }
  }

  useCatalogChrome({
    search,
    placeholder: 'Buscar unidad o símbolo...',
    onSearch: (value) => {
      setSearch(value)
      setPage(1)
    },
    actionLabel: 'Nueva unidad',
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
        <p className={styles.empty}>No hay unidades de medida.</p>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Símbolo</th>
                <th>Nombre</th>
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
                      <span>{item.symbol}</span>
                    </div>
                  </td>
                  <td>{item.name}</td>
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
        noun="unidades"
        onChange={setPage}
      />

      <Modal
        title={editing ? 'Editar unidad' : 'Nueva unidad'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="measurement-unit-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form
          id="measurement-unit-form"
          className={styles.formGrid}
          onSubmit={handleSubmit}
        >
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field
            label="Nombre"
            help="Nombre completo de la unidad (ej. Metro cúbico). Debe ser único."
          >
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Metro cúbico"
              required
            />
          </Field>
          <Field
            label="Símbolo"
            help="Abreviatura que verás en selects y reportes (ej. m³, m², und). Debe ser único."
          >
            <TextInput
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="m³"
              required
            />
          </Field>
        </form>
      </Modal>
    </section>
  )
}
