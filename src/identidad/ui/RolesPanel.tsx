import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createRole, listRoles, updateRole } from '@/identidad/api/rolesApi'
import type { Role } from '@/identidad/model/types'
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
  useToast,
} from '@/shared/ui'
import styles from './identidad.module.css'

function isProtectedSystemRole(role: Role): boolean {
  if (role.isSystem) return true
  return role.name === 'super_admin' || role.name === 'admin'
}

export function RolesPanel() {
  const toast = useToast()
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar roles')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

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

  return (
    <section>
      <div className={styles.toolbar}>
        <div className={styles.searchGrow}>
          <Field label="Buscar">
            <TextInput
              placeholder="Nombre del rol"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </Field>
        </div>
        <Button onClick={openCreate}>Nuevo rol</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay roles.</p>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((role) => {
            const system = Boolean(role.isSystem) || role.name === 'super_admin'
            const protectedDeactivate = isProtectedSystemRole(role)
            return (
              <article key={role.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h3 className={styles.cardTitle}>{role.name}</h3>
                    <p className={styles.cardSubtitle}>
                      {system ? 'Rol de sistema' : 'Rol de acceso'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {system ? <Badge tone="neutral">Sistema</Badge> : null}
                    <Badge tone={role.isActive === 1 ? 'success' : 'danger'}>
                      {role.isActive === 1 ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={system}
                    onClick={() => openEdit(role)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant={role.isActive === 1 ? 'danger' : 'ghost'}
                    size="sm"
                    disabled={protectedDeactivate}
                    onClick={() => void toggleActive(role)}
                  >
                    {role.isActive === 1 ? 'Desactivar' : 'Activar'}
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
