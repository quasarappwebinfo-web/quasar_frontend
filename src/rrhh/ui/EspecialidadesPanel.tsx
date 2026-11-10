import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createSpecialty,
  listActivePositions,
  listSpecialties,
  updateSpecialty,
} from '@/rrhh/api/catalogosRrhhApi'
import type { PositionOption, SpecialtyOption } from '@/rrhh/model/types'
import { ApiError } from '@/shared/api/apiJson'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import {
  Alert,
  Button,
  Field,
  Modal,
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
} from '@/task-pool/ui/CatalogParts'
import look from '@/task-pool/ui/taskPool.module.css'
import styles from './rrhh.module.css'

export function EspecialidadesPanel() {
  const toast = useToast()
  const refreshStats = useRefreshCatalogStats()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [activeOnly, setActiveOnly] = useState(false)
  const [filterPositionId, setFilterPositionId] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<SpecialtyOption[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [positions, setPositions] = useState<PositionOption[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SpecialtyOption | null>(null)
  const [name, setName] = useState('')
  const [positionId, setPositionId] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const positionNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const position of positions) {
      map.set(position.id, position.name)
    }
    return map
  }, [positions])

  useEffect(() => {
    void listActivePositions()
      .then(setPositions)
      .catch(() => setPositions([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listSpecialties({
        page,
        search: debouncedSearch,
        activeOnly: activeOnly || undefined,
        workerPositionId: filterPositionId ? Number(filterPositionId) : undefined,
      })
      setItems(data.specialties)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
      refreshStats()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar especialidades',
      )
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, activeOnly, filterPositionId, refreshStats])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setName('')
    setPositionId('')
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(specialty: SpecialtyOption) {
    setEditing(specialty)
    setName(specialty.name)
    setPositionId(
      specialty.workerPositionId ? String(specialty.workerPositionId) : '',
    )
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        name: name.trim(),
        workerPositionId: positionId ? Number(positionId) : null,
      }
      if (editing) {
        await updateSpecialty(editing.id, {
          ...payload,
          isActive: editing.isActive,
        })
        toast.success('Especialidad actualizada')
      } else {
        await createSpecialty(payload)
        toast.success('Especialidad creada')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('Ese nombre de especialidad ya existe.')
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(specialty: SpecialtyOption) {
    try {
      await updateSpecialty(specialty.id, {
        name: specialty.name,
        workerPositionId: specialty.workerPositionId,
        isActive: specialty.isActive === 1 ? 2 : 1,
      })
      toast.success(
        specialty.isActive === 1
          ? 'Especialidad desactivada'
          : 'Especialidad activada',
      )
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar estado')
    }
  }

  useCatalogChrome({
    search,
    placeholder: 'Buscar especialidad...',
    onSearch: (value) => {
      setSearch(value)
      setPage(1)
    },
    actionLabel: 'Nueva especialidad',
    onAction: openCreate,
  })

  return (
    <section>
      <div className={look.filterBar}>
        <label className={look.filterField}>
          Cargo
          <select
            value={filterPositionId}
            onChange={(event) => {
              setFilterPositionId(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Todos</option>
            {positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </select>
        </label>
        <label className={look.filterField}>
          Estado
          <select
            value={activeOnly ? '1' : '0'}
            onChange={(event) => {
              setActiveOnly(event.target.value === '1')
              setPage(1)
            }}
          >
            <option value="0">Todas</option>
            <option value="1">Solo activas</option>
          </select>
        </label>
        <button
          type="button"
          className={look.clearFilters}
          onClick={() => {
            setSearch('')
            setFilterPositionId('')
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
        <p className={styles.empty}>No hay especialidades.</p>
      ) : (
        <div className={look.tableCard}>
          <table className={look.table}>
            <thead>
              <tr>
                <th>Especialidad</th>
                <th>Cargo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((specialty) => {
                const linkedName = specialty.workerPositionId
                  ? positionNameById.get(specialty.workerPositionId)
                  : null
                return (
                  <tr key={specialty.id}>
                    <td>
                      <div className={look.nameCell}>
                        <ActivityMark name={specialty.name} />
                        <span>{specialty.name}</span>
                      </div>
                    </td>
                    <td>{linkedName || '—'}</td>
                    <td>
                      <StatusPill active={specialty.isActive === 1} />
                    </td>
                    <td>
                      <RowMenu
                        items={[
                          { label: 'Editar', onClick: () => openEdit(specialty) },
                          {
                            label: specialty.isActive === 1 ? 'Desactivar' : 'Activar',
                            danger: specialty.isActive === 1,
                            onClick: () => void toggleActive(specialty),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <CatalogPager
        page={page}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        noun="especialidades"
        onChange={setPage}
      />

      <Modal
        title={editing ? 'Editar especialidad' : 'Nueva especialidad'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="specialty-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form
          id="specialty-form"
          className={styles.formGrid}
          onSubmit={handleSubmit}
        >
          <Field label="Nombre">
            <TextInput
              required
              disabled={saving}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Electricidad"
            />
          </Field>
          <Field label="Cargo" hint="Opcional; limita la especialidad a un cargo">
            <TextSelect
              disabled={saving}
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
            >
              <option value="">Sin cargo</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>
    </section>
  )
}
