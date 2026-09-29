import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  canManageUser,
  roleHasFullAccess,
  useAuth,
} from '@/auth'
import { listPersons } from '@/identidad/api/personasApi'
import { listActiveRoles } from '@/identidad/api/rolesApi'
import {
  createUser,
  listPermissionCatalog,
  listUsers,
  resetUserPassword,
  updateUser,
  updateUserStatus,
} from '@/identidad/api/usersApi'
import type {
  ActiveStatus,
  AppUser,
  PermissionCatalogItem,
  Person,
  Role,
} from '@/identidad/model/types'
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
import styles from './identidad.module.css'

/** PersonIds que ya tienen usuario (activos e inactivos). */
async function loadTakenPersonIds(): Promise<Set<number>> {
  const taken = new Set<number>()
  let page = 1
  let totalPages = 1

  while (page <= totalPages && page <= 50) {
    const data = await listUsers({ page })
    for (const user of data.users) {
      taken.add(user.personId)
    }
    const perPage = data.pagination.itemsPerPage || 15
    totalPages = Math.max(1, Math.ceil(data.pagination.totalItems / perPage))
    page += 1
  }

  return taken
}

export function UsersPanel() {
  const toast = useToast()
  const { user: actor } = useAuth()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [statusId, setStatusId] = useState<'' | '1' | '2'>('1')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AppUser[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([])
  const [personQuery, setPersonQuery] = useState('')
  const debouncedPersonQuery = useDebouncedValue(personQuery)
  const [personResults, setPersonResults] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [takenPersonIds, setTakenPersonIds] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [statusUser, setStatusUser] = useState<AppUser | null>(null)
  const [reason, setReason] = useState('')
  const [statusError, setStatusError] = useState<string | null>(null)

  const [passwordUser, setPasswordUser] = useState<AppUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const selectedRoleName = useMemo(
    () => roles.find((role) => String(role.id) === roleId)?.name ?? null,
    [roles, roleId],
  )
  const showPermissionsChecklist = !roleHasFullAccess(selectedRoleName)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listUsers({
        page,
        search: debouncedSearch,
        statusId: statusId ? (Number(statusId) as ActiveStatus) : undefined,
      })
      setItems(data.users)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar usuarios')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!formOpen || editing) return
    let cancelled = false

    async function loadAvailablePersons() {
      const available: Person[] = []
      let page = 1
      let totalPages = 1

      while (available.length < 20 && page <= totalPages && page <= 10) {
        const data = await listPersons({
          page,
          search: debouncedPersonQuery,
        })
        totalPages = Math.max(
          1,
          Math.ceil(
            data.pagination.totalItems / (data.pagination.itemsPerPage || 15),
          ),
        )
        for (const person of data.persons) {
          if (!takenPersonIds.has(person.id)) available.push(person)
        }
        page += 1
      }

      if (!cancelled) setPersonResults(available)
    }

    void loadAvailablePersons().catch(() => {
      if (!cancelled) setPersonResults([])
    })

    return () => {
      cancelled = true
    }
  }, [formOpen, editing, debouncedPersonQuery, takenPersonIds])

  async function loadFormMeta() {
    const [activeRoles, taken] = await Promise.all([
      listActiveRoles(),
      loadTakenPersonIds(),
    ])
    setRoles(activeRoles)
    setTakenPersonIds(taken)
    try {
      const permissions = await listPermissionCatalog()
      setCatalog(permissions)
    } catch {
      setCatalog([])
    }
    return activeRoles
  }

  async function openCreate() {
    setEditing(null)
    setSelectedPerson(null)
    setPersonQuery('')
    setPersonResults([])
    setUsername('')
    setEmail('')
    setPassword('')
    setRoleId('')
    setSelectedPermissions([])
    setFormError(null)
    try {
      const activeRoles = await loadFormMeta()
      if (activeRoles[0]) setRoleId(String(activeRoles[0].id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron cargar roles')
      return
    }
    setFormOpen(true)
  }

  async function openEdit(user: AppUser) {
    if (!canManageUser(actor, user)) {
      toast.error('No puedes editar este usuario')
      return
    }
    setEditing(user)
    setSelectedPerson({
      id: user.personId,
      documentNumber: '',
      name: user.personName ?? `Persona #${user.personId}`,
      phone: null,
      photoUrl: null,
      birthDate: null,
    })
    setUsername(user.username)
    setEmail(user.email ?? '')
    setPassword('')
    setRoleId(String(user.roleId))
    setSelectedPermissions(user.permissions ?? [])
    setFormError(null)
    try {
      const activeRoles = await loadFormMeta()
      if (!activeRoles.some((role) => role.id === user.roleId) && user.roleName) {
        setRoles([
          ...activeRoles,
          {
            id: user.roleId,
            name: user.roleName,
            isActive: 1,
            isSystem: roleHasFullAccess(user.roleName),
          },
        ])
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron cargar roles')
      return
    }
    setFormOpen(true)
  }

  function togglePermission(code: string) {
    setSelectedPermissions((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)

    const permissionsPayload = showPermissionsChecklist
      ? selectedPermissions
      : undefined

    try {
      if (editing) {
        await updateUser(editing.id, {
          username: username.trim(),
          email: email.trim() || null,
          roleId: Number(roleId),
          ...(showPermissionsChecklist
            ? { permissions: permissionsPayload ?? [] }
            : {}),
        })
        toast.success('Usuario actualizado')
      } else {
        if (!selectedPerson) {
          setFormError('Elige una persona primero')
          setSaving(false)
          return
        }
        await createUser({
          personId: selectedPerson.id,
          username: username.trim(),
          password,
          email: email.trim() || null,
          roleId: Number(roleId),
          ...(showPermissionsChecklist
            ? { permissions: permissionsPayload ?? [] }
            : {}),
        })
        toast.success('Usuario creado')
      }
      setFormOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('Esa persona ya tiene un usuario.')
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function confirmStatus() {
    if (!statusUser) return
    setStatusError(null)

    const nextActive: ActiveStatus = statusUser.isActive === 1 ? 2 : 1
    if (nextActive === 2 && !reason.trim()) {
      setStatusError('El motivo es obligatorio para desactivar')
      return
    }

    try {
      await updateUserStatus(statusUser.id, {
        isActive: nextActive,
        deactivationReason: nextActive === 2 ? reason.trim() : undefined,
      })
      toast.success(
        nextActive === 2 ? 'Usuario desactivado' : 'Usuario reactivado',
      )
      setStatusUser(null)
      setReason('')
      await load()
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'No se pudo cambiar el estado')
    }
  }

  async function confirmPassword() {
    if (!passwordUser) return
    setPasswordError(null)
    if (newPassword.trim().length < 6) {
      setPasswordError('Usa al menos 6 caracteres')
      return
    }
    try {
      await resetUserPassword(passwordUser.id, newPassword)
      toast.success('Contraseña actualizada')
      setPasswordUser(null)
      setNewPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'No se pudo cambiar')
    }
  }

  return (
    <section>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <div className={styles.searchGrow}>
            <Field label="Buscar">
              <TextInput
                placeholder="Nombre, usuario o email"
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
              value={statusId}
              onChange={(e) => {
                setStatusId(e.target.value as '' | '1' | '2')
                setPage(1)
              }}
            >
              <option value="">Todos</option>
              <option value="1">Activos</option>
              <option value="2">Inactivos</option>
            </TextSelect>
          </Field>
        </div>
        <Button onClick={() => void openCreate()}>Nuevo usuario</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay usuarios con ese filtro.</p>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((user) => {
            const manageable = canManageUser(actor, user)
            return (
              <article key={user.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h3 className={styles.cardTitle}>{user.username}</h3>
                    <p className={styles.cardSubtitle}>
                      {user.personName || `Persona #${user.personId}`}
                    </p>
                  </div>
                  <Badge tone={user.isActive === 1 ? 'success' : 'danger'}>
                    {user.isActive === 1 ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>

                <div className={styles.cardMeta}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Email</span>
                    <span className={styles.metaValue}>{user.email || 'Sin email'}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Rol</span>
                    <span className={styles.metaValue}>
                      {user.roleName || `Rol #${user.roleId}`}
                      {user.hasFullAccess ? ' · acceso total' : ''}
                    </span>
                  </div>
                  {user.isActive === 2 && user.deactivationReason ? (
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Motivo</span>
                      <span className={styles.metaValue}>{user.deactivationReason}</span>
                    </div>
                  ) : null}
                </div>

                <div className={styles.rowActions}>
                  {manageable ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void openEdit(user)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPasswordUser(user)
                          setNewPassword('')
                          setPasswordError(null)
                        }}
                      >
                        Password
                      </Button>
                      <Button
                        variant={user.isActive === 1 ? 'danger' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          setStatusUser(user)
                          setReason('')
                          setStatusError(null)
                        }}
                      >
                        {user.isActive === 1 ? 'Desactivar' : 'Activar'}
                      </Button>
                    </>
                  ) : (
                    <span className={styles.mutedNote}>Protegido</span>
                  )}
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
        title={editing ? 'Editar usuario' : 'Nuevo usuario'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="user-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="user-form" className={styles.formGrid} onSubmit={handleSubmit}>
          {!editing ? (
            <div className={styles.personPick}>
              <Field label="Persona" hint="Solo personas sin usuario. Una persona = un usuario.">
                <TextInput
                  placeholder="Buscar persona…"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  disabled={saving}
                />
              </Field>
              {selectedPerson ? (
                <Alert tone="success">
                  {`Seleccionada: ${selectedPerson.name}${selectedPerson.documentNumber ? ` · ${selectedPerson.documentNumber}` : ''}`}
                </Alert>
              ) : null}
              <div className={styles.personResults}>
                {personResults.length === 0 ? (
                  <p className={styles.muted}>
                    No hay personas disponibles sin usuario. Crea una en la pestaña Personas
                    o busca otro nombre/cédula.
                  </p>
                ) : (
                  personResults.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className={`${styles.personOption} ${selectedPerson?.id === person.id ? styles.personOptionSelected : ''}`}
                      onClick={() => setSelectedPerson(person)}
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
              {`Persona: ${selectedPerson?.name ?? editing.personName ?? editing.personId}`}
            </Alert>
          )}

          <Field label="Usuario">
            <TextInput
              required
              disabled={saving}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          </Field>

          {!editing ? (
            <Field label="Contraseña">
              <TextInput
                required
                type="password"
                disabled={saving}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          ) : null}

          <Field label="Email">
            <TextInput
              type="email"
              disabled={saving}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Rol" hint="super_admin no se asigna desde la app.">
            <TextSelect
              required
              disabled={saving || roles.length === 0}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </TextSelect>
          </Field>

          {showPermissionsChecklist ? (
            <div className={styles.subPanel}>
              <p className={styles.formLead}>
                Permisos de módulo (solo roles operativos).
              </p>
              {catalog.length === 0 ? (
                <p className={styles.mutedNote}>No hay catálogo de permisos.</p>
              ) : (
                catalog.map((item) => (
                  <label key={item.code} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(item.code)}
                      onChange={() => togglePermission(item.code)}
                      disabled={saving}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      {item.description ? (
                        <span className={styles.mutedNote}> — {item.description}</span>
                      ) : null}
                    </span>
                  </label>
                ))
              )}
            </div>
          ) : (
            <Alert tone="info">
              Admin / super admin tienen acceso total: no usan checklist de permisos.
            </Alert>
          )}

          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>

      <Modal
        title={statusUser?.isActive === 1 ? 'Desactivar usuario' : 'Reactivar usuario'}
        open={Boolean(statusUser)}
        onClose={() => setStatusUser(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusUser(null)}>
              Cancelar
            </Button>
            <Button
              variant={statusUser?.isActive === 1 ? 'danger' : 'primary'}
              onClick={() => void confirmStatus()}
            >
              Confirmar
            </Button>
          </>
        }
      >
        {statusUser?.isActive === 1 ? (
          <Field label="Motivo" hint="Obligatorio">
            <TextArea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Fin de contrato"
            />
          </Field>
        ) : (
          <Alert tone="info">Se reactivará el acceso y se limpiará el motivo de baja.</Alert>
        )}
        {statusError ? <Alert tone="error">{statusError}</Alert> : null}
      </Modal>

      <Modal
        title="Nueva contraseña"
        open={Boolean(passwordUser)}
        onClose={() => setPasswordUser(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPasswordUser(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmPassword()}>Guardar</Button>
          </>
        }
      >
        <Field label={`Password para ${passwordUser?.username ?? ''}`}>
          <TextInput
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {passwordError ? <Alert tone="error">{passwordError}</Alert> : null}
      </Modal>
    </section>
  )
}
