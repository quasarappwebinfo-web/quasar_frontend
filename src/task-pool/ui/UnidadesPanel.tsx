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
  Badge,
  Button,
  Field,
  Modal,
  PaginationBar,
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
import styles from './taskPool.module.css'

export function UnidadesPanel() {
  const toast = useToast()
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar unidades')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, activeOnly])

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

  return (
    <section>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <div className={styles.searchGrow}>
            <Field
              label="Buscar"
              help="Filtra por nombre o símbolo (ej. m³, Metro cúbico)."
            >
              <TextInput
                placeholder="Nombre o símbolo"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </Field>
          </div>
          <Field
            label="Estado"
            help="«Solo activos» oculta unidades desactivadas. Los selects de Base Datos Actividades solo muestran activas."
          >
            <TextSelect
              value={activeOnly ? '1' : '0'}
              onChange={(e) => {
                setActiveOnly(e.target.value === '1')
                setPage(1)
              }}
            >
              <option value="0">Todos</option>
              <option value="1">Solo activos</option>
            </TextSelect>
          </Field>
        </div>
        <Button onClick={openCreate}>Nueva unidad</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay unidades de medida.</p>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.cardTitle}>{item.symbol}</h3>
                  <p className={styles.cardSubtitle}>{item.name}</p>
                </div>
                <Badge tone={item.isActive === 1 ? 'success' : 'danger'}>
                  {item.isActive === 1 ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className={styles.cardMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Símbolo</span>
                  <span className={styles.metaValue}>{item.symbol}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Nombre</span>
                  <span className={styles.metaValue}>{item.name}</span>
                </div>
              </div>
              <div className={styles.rowActions}>
                <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                  Editar
                </Button>
                <Button
                  variant={item.isActive === 1 ? 'danger' : 'ghost'}
                  size="sm"
                  onClick={() => void toggleActive(item)}
                >
                  {item.isActive === 1 ? 'Desactivar' : 'Activar'}
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
