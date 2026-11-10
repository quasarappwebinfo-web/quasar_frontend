import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createRole, listRoles, updateRole } from '@/identidad/api/rolesApi'
import type { Role } from '@/identidad/model/types'
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
import styles from './identidad.module.css'

function isProtectedSystemRole(role: Role): boolean {
  if (role.isSystem) return true
  return role.name === 'super_admin' || role.name === 'admin'
}

export function RolesPanel() {
  const toast = useToast()
  const refreshStats = useRefreshCatalogStats()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Role[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listRoles({ page, search: debouncedSearch })
      setItems(data.roles)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
      refreshStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar roles')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, refreshStats])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setName('')
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(role: Role) {
    if (role.isSystem || role.name === 'super_admin') {
      toast.error('Los roles de sistema no se pueden renombrar')
      return
    }
    setEditing(role)
    setName(role.name)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed === 'super_admin') {
      setFormError(
        'El rol super_admin no se crea desde la app (solo CLI / base de datos).',
      )
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateRole(editing.id, { name: trimmed, isActive: editing.isActive })
        toast.success('Rol actualizado')
      } else {
        await createRole(trimmed)
        toast.success('Rol creado')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('Ese nombre de rol ya existe.')
      } else if (err instanceof ApiError && err.status === 403) {
        setFormError(err.message)
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(role: Role) {
    if (isProtectedSystemRole(role)) {
      toast.error(`El rol «${role.name}» no se puede desactivar`)
      return
    }
    try {
      await updateRole(role.id, {
        name: role.name,
        isActive: role.isActive === 1 ? 2 : 1,
      })
      toast.success(
        role.isActive === 1 ? 'Rol desactivado' : 'Rol activado',
      )
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar estado')
    }
  }

  useCatalogChrome({
    search,
    placeholder: 'Buscar rol...',
    onSearch: (value) => {
      setSearch(value)
      setPage(1)
    },
    actionLabel: 'Nuevo rol',
    onAction: openCreate,
  })

  return (
    <section>
      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay roles.</p>
      ) : (
        <div className={look.tableCard}>
          <table className={look.table}>
            <thead>
              <tr>
                <th>Rol</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((role) => {
                const system = Boolean(role.isSystem) || role.name === 'super_admin'
                const protectedDeactivate = isProtectedSystemRole(role)
                return (
                  <tr key={role.id}>
                    <td>
                      <div className={look.nameCell}>
                        <ActivityMark name={role.name} />
                        <span>
                          {role.name}
                          {system ? <span className={look.fixedTag}>Sistema</span> : null}
                        </span>
                      </div>
                    </td>
                    <td>{system ? 'Rol de sistema' : 'Rol de acceso'}</td>
                    <td>
                      <StatusPill active={role.isActive === 1} />
                    </td>
                    <td>
                      <RowMenu
                        items={[
                          {
                            label: 'Editar',
                            onClick: () => {
                              if (!system) openEdit(role)
                            },
                          },
                          {
                            label: role.isActive === 1 ? 'Desactivar' : 'Activar',
                            danger: role.isActive === 1,
                            onClick: () => {
                              if (!protectedDeactivate) void toggleActive(role)
                            },
                          },
                        ].filter((item) =>
                          item.label === 'Editar' ? !system : !protectedDeactivate,
                        )}
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
        noun="roles"
        onChange={setPage}
      />

      <Modal
        title={editing ? 'Editar rol' : 'Nuevo rol'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="rol-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="rol-form" className={styles.formGrid} onSubmit={handleSubmit}>
          <Field label="Nombre">
            <TextInput
              required
              disabled={saving}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. supervisor"
            />
          </Field>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>
    </section>
  )
}
