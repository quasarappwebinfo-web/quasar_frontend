import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { listPersons } from '@/identidad/api/personasApi'
import { listUsers } from '@/identidad/api/usersApi'
import type { AppUser, Person } from '@/identidad/model/types'
import {
  listActivePositions,
  listActiveSpecialties,
} from '@/rrhh/api/catalogosRrhhApi'
import {
  createWorker,
  listWorkers,
  updateWorker,
  updateWorkerStatus,
} from '@/rrhh/api/trabajadoresApi'
import type {
  PositionOption,
  SpecialtyOption,
  Worker,
} from '@/rrhh/model/types'
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
import styles from './rrhh.module.css'

export function TrabajadoresPanel() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [activeOnly, setActiveOnly] = useState(true)
  const [filterPositionId, setFilterPositionId] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Worker[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [positions, setPositions] = useState<PositionOption[]>([])
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Worker | null>(null)
  const [personQuery, setPersonQuery] = useState('')
  const debouncedPersonQuery = useDebouncedValue(personQuery)
  const [personResults, setPersonResults] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [positionId, setPositionId] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [linkedUserId, setLinkedUserId] = useState('')
  const [personUsers, setPersonUsers] = useState<AppUser[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [statusWorker, setStatusWorker] = useState<Worker | null>(null)
  const [reason, setReason] = useState('')
  const [statusError, setStatusError] = useState<string | null>(null)

  useEffect(() => {
    void listActivePositions()
      .then(setPositions)
      .catch(() => setPositions([]))
  }, [])

  useEffect(() => {
    const workerPositionId = positionId ? Number(positionId) : undefined
    void listActiveSpecialties(
      workerPositionId ? { workerPositionId } : undefined,
    )
      .then(setSpecialties)
      .catch(() => setSpecialties([]))
  }, [positionId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listWorkers({
        page,
        search: debouncedSearch,
        activeOnly,
        workerPositionId: filterPositionId ? Number(filterPositionId) : undefined,
      })
      setItems(data.workers)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar trabajadores')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, activeOnly, filterPositionId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!formOpen || editing) return
    let cancelled = false
    void listPersons({ page: 1, search: debouncedPersonQuery }).then((data) => {
      if (!cancelled) setPersonResults(data.persons)
    })
    return () => {
      cancelled = true
    }
  }, [formOpen, editing, debouncedPersonQuery])

  useEffect(() => {
    if (!selectedPerson) {
      setPersonUsers([])
      return
    }
    let cancelled = false
    void listUsers({ page: 1, search: selectedPerson.name, statusId: 1 }).then(
      (data) => {
        if (cancelled) return
        setPersonUsers(
          data.users.filter((user) => user.personId === selectedPerson.id),
        )
      },
    )
    return () => {
      cancelled = true
    }
  }, [selectedPerson])

  const specialtyOptions = useMemo(() => {
    if (!positionId) return specialties
    return specialties.filter(
      (item) =>
        item.workerPositionId == null ||
        item.workerPositionId === Number(positionId),
    )
  }, [specialties, positionId])

  function openCreate() {
    setEditing(null)
    setSelectedPerson(null)
    setPersonQuery('')
    setPersonResults([])
    setPositionId('')
    setSpecialtyId('')
    setLinkedUserId('')
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(worker: Worker) {
    setEditing(worker)
    setSelectedPerson({
      id: worker.personId,
      documentNumber: worker.documentNumber ?? '',
      name: worker.personName ?? `Persona #${worker.personId}`,
      phone: null,
      photoUrl: null,
      birthDate: null,
    })
    setPositionId(worker.workerPositionId ? String(worker.workerPositionId) : '')
    setSpecialtyId(worker.specialtyId ? String(worker.specialtyId) : '')
    setLinkedUserId(worker.linkedUserId ? String(worker.linkedUserId) : '')
    setFormError(null)
    setFormOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        workerPositionId: positionId ? Number(positionId) : null,
        specialtyId: specialtyId ? Number(specialtyId) : null,
        linkedUserId: linkedUserId ? Number(linkedUserId) : null,
      }

      if (editing) {
        await updateWorker(editing.id, payload)
        toast.success('Trabajador actualizado')
      } else {
        if (!selectedPerson) {
          setFormError('Elige una persona primero')
          setSaving(false)
          return
        }
        await createWorker({
          personId: selectedPerson.id,
          ...payload,
        })
        toast.success('Trabajador creado')
      }
      setFormOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(
          `${err.message}. Esa persona ya está registrada como trabajador.`,
        )
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function confirmStatus() {
    if (!statusWorker) return
    setStatusError(null)
    const nextActive = statusWorker.isActive === 1 ? 2 : 1
    if (nextActive === 2 && !reason.trim()) {
      setStatusError('El motivo es obligatorio para la baja RRHH')
      return
    }
    try {
      await updateWorkerStatus(statusWorker.id, {
        isActive: nextActive as 1 | 2,
        deactivationReason: nextActive === 2 ? reason.trim() : undefined,
      })
      toast.success(
        nextActive === 2 ? 'Trabajador dado de baja' : 'Trabajador reactivado',
      )
      setStatusWorker(null)
      setReason('')
      await load()
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'No se pudo cambiar el estado')
    }
  }

  return (
    <section>
      <Alert tone="info">
        Baja RRHH no es lo mismo que sacar de una obra. Usa Asignaciones para
        sacar de obra.
      </Alert>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <div className={styles.searchGrow}>
            <Field label="Buscar">
              <TextInput
                placeholder="Nombre o cédula"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </Field>
          </div>
          <Field label="Estado">
            <TextSelect
              value={activeOnly ? '1' : '0'}
              onChange={(e) => {
                setActiveOnly(e.target.value === '1')
                setPage(1)
              }}
            >
              <option value="1">Activos</option>
              <option value="0">Todos</option>
            </TextSelect>
          </Field>
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
        </div>
        <Button onClick={openCreate}>Nuevo trabajador</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>
          No hay trabajadores. Crea una persona en Personal y luego regístrala aquí.
        </p>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((worker) => (
            <article key={worker.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.cardTitle}>
                    {worker.personName || `Persona #${worker.personId}`}
                  </h3>
                  <p className={styles.cardSubtitle}>
                    {worker.documentNumber || 'Sin documento'}
                  </p>
                </div>
                <Badge tone={worker.isActive === 1 ? 'success' : 'danger'}>
                  {worker.isActive === 1 ? 'Activo' : 'Baja'}
                </Badge>
              </div>

              <div className={styles.cardMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Cargo</span>
                  <span className={styles.metaValue}>
                    {worker.positionName || '—'}
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Especialidad</span>
                  <span className={styles.metaValue}>
                    {worker.specialtyName || '—'}
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Usuario vinculado</span>
                  <span className={styles.metaValue}>
                    {worker.linkedUsername || 'Sin usuario'}
                  </span>
                </div>
                {worker.isActive === 2 && worker.deactivationReason ? (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Motivo baja</span>
                    <span className={styles.metaValue}>
                      {worker.deactivationReason}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className={styles.rowActions}>
                <Button variant="ghost" size="sm" onClick={() => openEdit(worker)}>
                  Editar
                </Button>
                <Button
                  variant={worker.isActive === 1 ? 'danger' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setStatusWorker(worker)
                    setReason('')
                    setStatusError(null)
                  }}
                >
                  {worker.isActive === 1 ? 'Baja RRHH' : 'Reactivar'}
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
        title={editing ? 'Editar trabajador' : 'Nuevo trabajador'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="worker-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="worker-form" className={styles.formGrid} onSubmit={handleSubmit}>
          {!editing ? (
            <div className={styles.personPick}>
              <Field
                label="Persona"
                hint="Debe existir en Personal. Una persona = un trabajador."
              >
                <TextInput
                  placeholder="Buscar por nombre o cédula…"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  disabled={saving}
                />
              </Field>
              {selectedPerson ? (
                <Alert tone="success">
                  {`Seleccionada: ${selectedPerson.name} · ${selectedPerson.documentNumber}`}
                </Alert>
              ) : null}
              <div className={styles.personResults}>
                {personResults.length === 0 ? (
                  <p className={styles.muted}>
                    Sin resultados. Crea la persona en Personal primero.
                  </p>
                ) : (
                  personResults.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className={`${styles.personOption} ${selectedPerson?.id === person.id ? styles.personOptionSelected : ''}`}
                      onClick={() => {
                        setSelectedPerson(person)
                        setLinkedUserId('')
                      }}
                    >
                      <strong>{person.name}</strong>
                      <span>{person.documentNumber}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <Alert tone="info">
              {`Persona: ${selectedPerson?.name ?? editing.personName} (no se puede cambiar)`}
            </Alert>
          )}

          <Field label="Cargo">
            <TextSelect
              disabled={saving}
              value={positionId}
              onChange={(e) => {
                setPositionId(e.target.value)
                setSpecialtyId('')
              }}
            >
              <option value="">Sin cargo</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </TextSelect>
          </Field>

          <Field label="Especialidad">
            <TextSelect
              disabled={saving}
              value={specialtyId}
              onChange={(e) => setSpecialtyId(e.target.value)}
            >
              <option value="">Sin especialidad</option>
              {specialtyOptions.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </option>
              ))}
            </TextSelect>
          </Field>

          <Field
            label="Usuario vinculado"
            hint="Opcional. Debe ser usuario de la misma persona."
          >
            <TextSelect
              disabled={saving || !selectedPerson}
              value={linkedUserId}
              onChange={(e) => setLinkedUserId(e.target.value)}
            >
              <option value="">Sin usuario</option>
              {personUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
              {editing?.linkedUserId &&
              !personUsers.some((user) => user.id === editing.linkedUserId) ? (
                <option value={editing.linkedUserId}>
                  {editing.linkedUsername || `Usuario #${editing.linkedUserId}`}
                </option>
              ) : null}
            </TextSelect>
          </Field>

          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>

      <Modal
        title={
          statusWorker?.isActive === 1
            ? 'Baja RRHH del trabajador'
            : 'Reactivar trabajador'
        }
        open={Boolean(statusWorker)}
        onClose={() => setStatusWorker(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusWorker(null)}>
              Cancelar
            </Button>
            <Button
              variant={statusWorker?.isActive === 1 ? 'danger' : 'primary'}
              onClick={() => void confirmStatus()}
            >
              Confirmar
            </Button>
          </>
        }
      >
        {statusWorker?.isActive === 1 ? (
          <>
            <Alert tone="info">
              Esto da de baja al trabajador en RRHH. No lo saca de una obra.
            </Alert>
            <Field label="Motivo" hint="Obligatorio">
              <TextArea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Fin de contrato"
              />
            </Field>
          </>
        ) : (
          <Alert tone="info">Se reactivará el trabajador y se limpiará el motivo.</Alert>
        )}
        {statusError ? <Alert tone="error">{statusError}</Alert> : null}
      </Modal>
    </section>
  )
}
