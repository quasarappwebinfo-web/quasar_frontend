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
  Badge,
  Button,
  Field,
  Modal,
  PaginationBar,
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
import styles from './rrhh.module.css'

export function EspecialidadesPanel() {
  const toast = useToast()
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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar especialidades',
      )
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, activeOnly, filterPositionId])

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

  return (
    <section>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <div className={styles.searchGrow}>
            <Field label="Buscar">
              <TextInput
                placeholder="Nombre de especialidad"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </Field>
          </div>
          <Field label="Cargo">
            <TextSelect
              value={filterPositionId}
              onChange={(e) => {
                setFilterPositionId(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Todos</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="Estado">
            <TextSelect
              value={activeOnly ? '1' : '0'}
              onChange={(e) => {
                setActiveOnly(e.target.value === '1')
                setPage(1)
              }}
            >
              <option value="0">Todas</option>
              <option value="1">Solo activas</option>
            </TextSelect>
          </Field>
        </div>
        <Button onClick={openCreate}>Nueva especialidad</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay especialidades.</p>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((specialty) => {
            const linkedName = specialty.workerPositionId
              ? positionNameById.get(specialty.workerPositionId)
              : null
            return (
              <article key={specialty.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h3 className={styles.cardTitle}>{specialty.name}</h3>
                    <p className={styles.cardSubtitle}>
                      {linkedName
                        ? `Cargo: ${linkedName}`
                        : specialty.workerPositionId
                          ? `Cargo #${specialty.workerPositionId}`
                          : 'Sin cargo vinculado'}
                    </p>
                  </div>
                  <Badge tone={specialty.isActive === 1 ? 'success' : 'danger'}>
                    {specialty.isActive === 1 ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                <div className={styles.rowActions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(specialty)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant={specialty.isActive === 1 ? 'danger' : 'ghost'}
                    size="sm"
                    onClick={() => void toggleActive(specialty)}
                  >
                    {specialty.isActive === 1 ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <PaginationBar
        page={page}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
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
