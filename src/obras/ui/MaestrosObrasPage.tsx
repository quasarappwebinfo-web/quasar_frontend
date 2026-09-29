import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  createDocumentType,
  createSaleType,
  createStage,
  listDocumentTypes,
  listSaleTypes,
  listStages,
  updateDocumentType,
  updateSaleType,
  updateStage,
} from '@/obras/api/catalogosObrasApi'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { cn } from '@/shared/lib/cn'
import {
  Alert,
  Badge,
  Button,
  Field,
  Modal,
  TextArea,
  TextInput,
  useToast,
} from '@/shared/ui'
import styles from './ObraDetailPage.module.css'

const TABS = [
  { to: '/dashboard/maestros/tipos-venta', label: 'Tipos de venta' },
  { to: '/dashboard/maestros/etapas', label: 'Etapas' },
  { to: '/dashboard/maestros/tipos-documento', label: 'Tipos de documento' },
] as const

export function MaestrosObrasPage() {
  const navigate = useNavigate()
  useDocumentTitle('Quasar · Configuración Global')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate('/dashboard')}
          >
            ← Dashboard
          </button>
          <h1 className={styles.title}>Configuración Global</h1>
          <p className={styles.subtitle}>
            Tipos de venta, etapas constructivas y tipos de documento.{' '}
            <Link to="/maestros/task-pool">Ir a Base Datos Actividades →</Link>
          </p>
        </div>
      </header>

      <div className={styles.tabs} role="tablist">
        {TABS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(styles.tab, isActive && styles.tabActive)}
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}

type CatalogItem = {
  id: number
  name: string
  isActive: 1 | 2
  description?: string | null
  displayOrder?: number
}

function CatalogCards({
  title,
  items,
  loading,
  error,
  onCreate,
  onEdit,
  onToggle,
}: {
  title: string
  items: CatalogItem[]
  loading: boolean
  error: string | null
  onCreate: () => void
  onEdit: (item: CatalogItem) => void
  onToggle: (item: CatalogItem) => void
}) {
  return (
    <section>
      <div className={styles.toolbar}>
        <p className={styles.muted}>{title}</p>
        <Button onClick={onCreate}>Nuevo</Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Sin registros.</p>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.cardTitle}>{item.name}</h3>
                  <p className={styles.cardSubtitle}>
                    {item.description ||
                      (item.displayOrder != null
                        ? `Orden ${item.displayOrder}`
                        : 'Catálogo')}
                  </p>
                </div>
                <Badge tone={item.isActive === 1 ? 'success' : 'danger'}>
                  {item.isActive === 1 ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className={styles.rowActions}>
                <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                  Editar
                </Button>
                <Button
                  variant={item.isActive === 1 ? 'danger' : 'ghost'}
                  size="sm"
                  onClick={() => onToggle(item)}
                >
                  {item.isActive === 1 ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function TiposVentaPanel() {
  const toast = useToast()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listSaleTypes({ page: 1 })
      setItems(data.saleTypes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateSaleType(editing.id, {
          name: name.trim(),
          isActive: editing.isActive,
        })
        toast.success('Tipo de venta actualizado')
      } else {
        await createSaleType(name.trim())
        toast.success('Tipo de venta creado')
      }
      setOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CatalogCards
        title="Tipos de venta"
        items={items}
        loading={loading}
        error={error}
        onCreate={() => {
          setEditing(null)
          setName('')
          setFormError(null)
          setOpen(true)
        }}
        onEdit={(item) => {
          setEditing(item)
          setName(item.name)
          setFormError(null)
          setOpen(true)
        }}
        onToggle={(item) => {
          void updateSaleType(item.id, {
            name: item.name,
            isActive: item.isActive === 1 ? 2 : 1,
          })
            .then(() => load())
            .then(() =>
              toast.success(item.isActive === 1 ? 'Desactivado' : 'Activado'),
            )
            .catch((err) =>
              toast.error(err instanceof Error ? err.message : 'Error'),
            )
        }}
      />
      <Modal
        title={editing ? 'Editar tipo de venta' : 'Nuevo tipo de venta'}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="sale-type-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="sale-type-form" className={styles.formGrid} onSubmit={handleSubmit}>
          <Field label="Nombre">
            <TextInput
              required
              disabled={saving}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Por encargo"
            />
          </Field>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>
    </>
  )
}

export function EtapasObraPanel() {
  const toast = useToast()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [displayOrder, setDisplayOrder] = useState('10')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listStages({ page: 1 })
      setItems(
        [...data.stages].sort((a, b) => a.displayOrder - b.displayOrder),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateStage(editing.id, {
          name: name.trim(),
          description: description.trim() || null,
          displayOrder: Number(displayOrder),
          isActive: editing.isActive,
        })
        toast.success('Etapa actualizada')
      } else {
        await createStage({
          name: name.trim(),
          description: description.trim() || null,
          displayOrder: Number(displayOrder),
        })
        toast.success('Etapa creada')
      }
      setOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CatalogCards
        title="Etapas de obra"
        items={items}
        loading={loading}
        error={error}
        onCreate={() => {
          setEditing(null)
          setName('')
          setDescription('')
          setDisplayOrder(String((items.at(-1)?.displayOrder ?? 0) + 10))
          setFormError(null)
          setOpen(true)
        }}
        onEdit={(item) => {
          setEditing(item)
          setName(item.name)
          setDescription(item.description || '')
          setDisplayOrder(String(item.displayOrder ?? 10))
          setFormError(null)
          setOpen(true)
        }}
        onToggle={(item) => {
          void updateStage(item.id, {
            name: item.name,
            description: item.description,
            displayOrder: item.displayOrder,
            isActive: item.isActive === 1 ? 2 : 1,
          })
            .then(() => load())
            .then(() =>
              toast.success(item.isActive === 1 ? 'Desactivada' : 'Activada'),
            )
            .catch((err) =>
              toast.error(err instanceof Error ? err.message : 'Error'),
            )
        }}
      />
      <Modal
        title={editing ? 'Editar etapa' : 'Nueva etapa'}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="stage-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="stage-form" className={styles.formGrid} onSubmit={handleSubmit}>
          <Field label="Nombre">
            <TextInput
              required
              disabled={saving}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Descripción">
            <TextArea
              disabled={saving}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Orden">
            <TextInput
              required
              type="number"
              disabled={saving}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
            />
          </Field>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>
    </>
  )
}

export function TiposDocumentoPanel() {
  const toast = useToast()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listDocumentTypes({ page: 1 })
      setItems(data.documentTypes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateDocumentType(editing.id, {
          name: name.trim(),
          description: description.trim() || null,
          isActive: editing.isActive,
        })
        toast.success('Tipo de documento actualizado')
      } else {
        await createDocumentType({
          name: name.trim(),
          description: description.trim() || null,
        })
        toast.success('Tipo de documento creado')
      }
      setOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CatalogCards
        title="Tipos de documento"
        items={items}
        loading={loading}
        error={error}
        onCreate={() => {
          setEditing(null)
          setName('')
          setDescription('')
          setFormError(null)
          setOpen(true)
        }}
        onEdit={(item) => {
          setEditing(item)
          setName(item.name)
          setDescription(item.description || '')
          setFormError(null)
          setOpen(true)
        }}
        onToggle={(item) => {
          void updateDocumentType(item.id, {
            name: item.name,
            description: item.description,
            isActive: item.isActive === 1 ? 2 : 1,
          })
            .then(() => load())
            .then(() =>
              toast.success(item.isActive === 1 ? 'Desactivado' : 'Activado'),
            )
            .catch((err) =>
              toast.error(err instanceof Error ? err.message : 'Error'),
            )
        }}
      />
      <Modal
        title={editing ? 'Editar tipo de documento' : 'Nuevo tipo de documento'}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="doc-type-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="doc-type-form" className={styles.formGrid} onSubmit={handleSubmit}>
          <Field label="Nombre">
            <TextInput
              required
              disabled={saving}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Descripción">
            <TextArea
              disabled={saving}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>
    </>
  )
}
