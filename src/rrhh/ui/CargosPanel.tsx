import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createPosition,
  listPositions,
  updatePosition,
} from '@/rrhh/api/catalogosRrhhApi'
import type { PositionOption } from '@/rrhh/model/types'
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
} from '@/task-pool/ui/CatalogParts'
import look from '@/task-pool/ui/taskPool.module.css'
import styles from './rrhh.module.css'

export function CargosPanel() {
  const toast = useToast()
  const refreshStats = useRefreshCatalogStats()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [activeOnly, setActiveOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<PositionOption[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PositionOption | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listPositions({
        page,
        search: debouncedSearch,
        activeOnly: activeOnly || undefined,
      })
      setItems(data.positions)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
      refreshStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar cargos')
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
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(position: PositionOption) {
    setEditing(position)
    setName(position.name)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updatePosition(editing.id, {
          name: name.trim(),
          isActive: editing.isActive,
        })
        toast.success('Cargo actualizado')
      } else {
        await createPosition(name.trim())
        toast.success('Cargo creado')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('Ese nombre de cargo ya existe.')
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(position: PositionOption) {
    try {
      await updatePosition(position.id, {
        name: position.name,
        isActive: position.isActive === 1 ? 2 : 1,
      })
      toast.success(
        position.isActive === 1 ? 'Cargo desactivado' : 'Cargo activado',
      )
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar estado')
    }
  }

  useCatalogChrome({
    search,
    placeholder: 'Buscar cargo...',
    onSearch: (value) => {
      setSearch(value)
      setPage(1)
    },
    actionLabel: 'Nuevo cargo',
    onAction: openCreate,
  })

  return (
    <section>
      <div className={look.filterBar}>
        <label className={look.filterField}>
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
          className={look.clearFilters}
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
        <p className={styles.empty}>No hay cargos.</p>
      ) : (
        <div className={look.tableCard}>
          <table className={look.table}>
            <thead>
              <tr>
                <th>Cargo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((position) => (
                <tr key={position.id}>
                  <td>
                    <div className={look.nameCell}>
                      <ActivityMark name={position.name} />
                      <span>{position.name}</span>
                    </div>
                  </td>
                  <td>
                    <StatusPill active={position.isActive === 1} />
                  </td>
                  <td>
                    <RowMenu
                      items={[
                        { label: 'Editar', onClick: () => openEdit(position) },
                        {
                          label: position.isActive === 1 ? 'Desactivar' : 'Activar',
                          danger: position.isActive === 1,
                          onClick: () => void toggleActive(position),
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
        noun="cargos"
        onChange={setPage}
      />

      <Modal
        title={editing ? 'Editar cargo' : 'Nuevo cargo'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="cargo-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="cargo-form" className={styles.formGrid} onSubmit={handleSubmit}>
          <Field label="Nombre">
            <TextInput
              required
              disabled={saving}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Oficial"
            />
          </Field>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>
    </section>
  )
}
