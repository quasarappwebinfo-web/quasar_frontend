import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createPerson,
  listPersons,
  updatePerson,
} from '@/identidad/api/personasApi'
import { listActiveRoles } from '@/identidad/api/rolesApi'
import { createUser, listUsers } from '@/identidad/api/usersApi'
import type { Person, Role } from '@/identidad/model/types'
import {
  listActivePositions,
  listActiveSpecialties,
} from '@/rrhh/api/catalogosRrhhApi'
import { createWorker, listWorkers } from '@/rrhh/api/trabajadoresApi'
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
  useCatalogChrome,
  useRefreshCatalogStats,
} from '@/task-pool/ui/CatalogParts'
import look from '@/task-pool/ui/taskPool.module.css'
import styles from './identidad.module.css'

async function collectPersonIds(
  fetchPage: (page: number) => Promise<{
    ids: number[]
    totalItems: number
    itemsPerPage: number
  }>,
): Promise<Set<number>> {
  const ids = new Set<number>()
  let page = 1
  let totalPages = 1

  while (page <= totalPages && page <= 40) {
    const data = await fetchPage(page)
    for (const id of data.ids) ids.add(id)
    const perPage = data.itemsPerPage || 15
    totalPages = Math.max(1, Math.ceil(data.totalItems / perPage))
    page += 1
  }

  return ids
}

export function PersonasPanel() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Person[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userPersonIds, setUserPersonIds] = useState<Set<number> | null>(null)
  const [workerPersonIds, setWorkerPersonIds] = useState<Set<number> | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)
  const [documentNumber, setDocumentNumber] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [alsoUser, setAlsoUser] = useState(false)
  const [alsoWorker, setAlsoWorker] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [positionId, setPositionId] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [positions, setPositions] = useState<PositionOption[]>([])
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([])
  const refreshStats = useRefreshCatalogStats()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listPersons({ page, search: debouncedSearch })
      setItems(data.persons)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
      refreshStats()

      const apiSendsRoles = data.persons.some(
        (person) =>
          typeof person.isUser === 'boolean' || typeof person.isWorker === 'boolean',
      )
      if (apiSendsRoles || data.persons.length === 0) {
        setUserPersonIds(null)
        setWorkerPersonIds(null)
      } else {
        const [users, workers] = await Promise.all([
          collectPersonIds(async (nextPage) => {
            const usersPage = await listUsers({ page: nextPage })
            return {
              ids: usersPage.users.map((user) => user.personId),
              totalItems: usersPage.pagination.totalItems,
              itemsPerPage: usersPage.pagination.itemsPerPage,
            }
          }).catch(() => new Set<number>()),
          collectPersonIds(async (nextPage) => {
            const workersPage = await listWorkers({ page: nextPage })
            return {
              ids: workersPage.workers.map((worker) => worker.personId),
              totalItems: workersPage.pagination.totalItems,
              itemsPerPage: workersPage.pagination.itemsPerPage,
            }
          }).catch(() => new Set<number>()),
        ])
        setUserPersonIds(users)
        setWorkerPersonIds(workers)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar personas')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, refreshStats])

  useEffect(() => {
    void load()
  }, [load])

  const specialtyOptions = useMemo(() => {
    if (!positionId) return specialties
    return specialties.filter(
      (item) =>
        item.workerPositionId == null ||
        item.workerPositionId === Number(positionId),
    )
  }, [specialties, positionId])

  function resetCreateExtras() {
    setAlsoUser(false)
    setAlsoWorker(false)
    setUsername('')
    setPassword('')
    setEmail('')
    setRoleId('')
    setPositionId('')
    setSpecialtyId('')
  }

  async function openCreate() {
    setEditing(null)
    setDocumentNumber('')
    setName('')
    setFormError(null)
    resetCreateExtras()
    setModalOpen(true)
    try {
      const [activeRoles, activePositions, activeSpecialties] = await Promise.all([
        listActiveRoles(),
        listActivePositions(),
        listActiveSpecialties(),
      ])
      setRoles(activeRoles)
      setPositions(activePositions)
      setSpecialties(activeSpecialties)
      if (activeRoles[0]) setRoleId(String(activeRoles[0].id))
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar roles/cargos para el alta combinada',
      )
    }
  }

  function openEdit(person: Person) {
    setEditing(person)
    setDocumentNumber(person.documentNumber)
    setName(person.name)
    setFormError(null)
    resetCreateExtras()
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)

    try {
      if (editing) {
        await updatePerson(editing.id, {
          name: name.trim(),
        })
        toast.success('Persona actualizada')
        setModalOpen(false)
        await load()
        return
      }

      if (alsoUser) {
        if (!username.trim() || !password || !roleId) {
          setFormError('Usuario: username, contraseña y rol son obligatorios.')
          setSaving(false)
          return
        }
        if (password.trim().length < 6) {
          setFormError('La contraseña debe tener al menos 6 caracteres.')
          setSaving(false)
          return
        }
      }

      const person = await createPerson({
        documentNumber: documentNumber.trim(),
        name: name.trim(),
      })

      const parts: string[] = ['Persona creada']
      let createdUserId: number | null = null

      if (alsoUser) {
        try {
          const user = await createUser({
            personId: person.id,
            username: username.trim(),
            password,
            email: email.trim() || null,
            roleId: Number(roleId),
          })
          createdUserId = user.id
          parts.push('usuario')
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error al crear usuario'
          setFormError(
            `Persona #${person.id} ya existe, pero el usuario falló: ${msg}. Completa en Personal → Usuarios.`,
          )
          toast.error('Persona creada; falló el usuario')
          await load()
          setSaving(false)
          return
        }
      }

      if (alsoWorker) {
        try {
          await createWorker({
            personId: person.id,
            workerPositionId: positionId ? Number(positionId) : null,
            specialtyId: specialtyId ? Number(specialtyId) : null,
            linkedUserId: createdUserId,
          })
          parts.push('trabajador')
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Error al crear trabajador'
          setFormError(
            `Persona creada${createdUserId ? ' y usuario también' : ''}, pero el trabajador falló: ${msg}. Completa en RRHH → Trabajadores.`,
          )
          toast.error('Alta parcial: faltó el trabajador')
          await load()
          setSaving(false)
          return
        }
      }

      toast.success(parts.join(' + '))
      setModalOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(
          `${err.message}. Busca esa cédula en el listado; no se puede duplicar.`,
        )
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  useCatalogChrome({
    search,
    placeholder: 'Buscar persona o cédula...',
    onSearch: (value) => {
      setSearch(value)
      setPage(1)
    },
    actionLabel: 'Nueva persona',
    onAction: () => void openCreate(),
  })

  return (
    <section>
      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay personas. Crea la primera.</p>
      ) : (
        <div className={look.tableCard}>
          <table className={look.table}>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Cédula</th>
                <th>Usuario</th>
                <th>Trabajador</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((person) => {
                const isUser = person.isUser ?? userPersonIds?.has(person.id) ?? false
                const isWorker = person.isWorker ?? workerPersonIds?.has(person.id) ?? false
                return (
                  <tr key={person.id}>
                    <td>
                      <div className={look.nameCell}>
                        <ActivityMark name={person.name} />
                        <span>{person.name}</span>
                      </div>
                    </td>
                    <td>{person.documentNumber}</td>
                    <td>{isUser ? 'Sí' : '—'}</td>
                    <td>{isWorker ? 'Sí' : '—'}</td>
                    <td>
                      <RowMenu items={[{ label: 'Editar', onClick: () => openEdit(person) }]} />
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
        noun="personas"
        onChange={setPage}
      />

      <Modal
        title={editing ? 'Editar persona' : 'Nueva persona'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        wide={!editing}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="persona-form" disabled={saving}>
              {saving ? 'Guardando…' : editing ? 'Guardar' : 'Crear'}
            </Button>
          </>
        }
      >
        <form id="persona-form" className={styles.formGrid} onSubmit={handleSubmit}>
          {!editing ? (
            <p className={styles.formLead}>
              Crea la persona y, si quieres, el usuario de acceso y/o el
              trabajador RRHH en el mismo paso.
            </p>
          ) : null}

          <Field
            label="Cédula / documento"
            hint={editing ? 'La cédula no se puede cambiar' : undefined}
          >
            <TextInput
              required
              disabled={Boolean(editing) || saving}
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </Field>
          <Field label="Nombre completo">
            <TextInput
              required
              disabled={saving}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          {!editing ? (
            <>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={alsoUser}
                  disabled={saving}
                  onChange={(e) => {
                    setAlsoUser(e.target.checked)
                    if (
                      e.target.checked &&
                      !username &&
                      documentNumber.trim()
                    ) {
                      setUsername(documentNumber.trim())
                    }
                  }}
                />
                <span>
                  También crear <strong>usuario</strong> (acceso al sistema)
                </span>
              </label>

              {alsoUser ? (
                <div className={styles.subPanel}>
                  <div className={styles.twoCol}>
                    <Field label="Username">
                      <TextInput
                        required
                        disabled={saving}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Contraseña" hint="Mínimo 6 caracteres">
                      <TextInput
                        type="password"
                        required
                        disabled={saving}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </Field>
                  </div>
                  <div className={styles.twoCol}>
                    <Field label="Email">
                      <TextInput
                        type="email"
                        disabled={saving}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </Field>
                    <Field label="Rol" hint="No incluye super_admin (solo CLI / BD).">
                      <TextSelect
                        required
                        disabled={saving}
                        value={roleId}
                        onChange={(e) => setRoleId(e.target.value)}
                      >
                        <option value="">Seleccionar…</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </TextSelect>
                    </Field>
                  </div>
                </div>
              ) : null}

              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={alsoWorker}
                  disabled={saving}
                  onChange={(e) => setAlsoWorker(e.target.checked)}
                />
                <span>
                  También registrar como <strong>trabajador</strong> (RRHH)
                </span>
              </label>

              {alsoWorker ? (
                <div className={styles.subPanel}>
                  <div className={styles.twoCol}>
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
                  </div>
                  {alsoUser ? (
                    <p className={styles.mutedNote}>
                      Si creas usuario, se vinculará automáticamente al
                      trabajador.
                    </p>
                  ) : (
                    <p className={styles.mutedNote}>
                      Puedes vincular un usuario después desde RRHH →
                      Trabajadores.
                    </p>
                  )}
                </div>
              ) : null}
            </>
          ) : null}

          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>
    </section>
  )
}
