import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createPosition, createSpecialty, listActivePositions, listActiveSpecialties } from '@/rrhh/api/catalogosRrhhApi'
import type { PositionOption, SpecialtyOption } from '@/rrhh/model/types'
import { listActiveTaskTemplates } from '@/task-pool/api/plantillasApi'
import { listActiveMeasurementUnits } from '@/task-pool/api/unidadesMedidaApi'
import {
  addVersionDependency,
  addVersionMeasurement,
  addVersionPosition,
  addVersionSubtask,
  archiveTaskTemplateVersion,
  createTaskTemplateVersion,
  deleteVersionDependency,
  deleteVersionMeasurement,
  deleteVersionPosition,
  deleteVersionSubtask,
  getTaskTemplateVersion,
  publishTaskTemplateVersion,
  updateTaskTemplateVersion,
  updateVersionPosition,
  updateVersionSubtask,
} from '@/task-pool/api/versionesApi'
import type {
  DependencyType,
  MeasurementUnit,
  TaskTemplate,
  VersionDetail,
} from '@/task-pool/model/types'
import {
  DEPENDENCY_TYPE_LABELS,
  VERSION_STATUS_LABELS,
} from '@/task-pool/model/types'
import { ApiError } from '@/shared/api/apiJson'
import { cn } from '@/shared/lib/cn'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import {
  Alert,
  Badge,
  Button,
  Field,
  Modal,
  TextArea,
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
import { RecomendarModal } from './RecomendarModal'
import styles from './taskPool.module.css'

type DetailTab = 'unidades' | 'cargos' | 'subactividades' | 'dependencias'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'unidades', label: 'Unidades' },
  { id: 'cargos', label: 'Cargos' },
  { id: 'subactividades', label: 'Subactividades' },
  { id: 'dependencias', label: 'Dependencias' },
]

function statusTone(
  status: string,
): 'neutral' | 'success' | 'danger' {
  if (status === 'published') return 'success'
  if (status === 'archived') return 'danger'
  return 'neutral'
}

function asFlag(value: unknown): boolean {
  return Number(value) === 1
}

export function VersionEditorPage() {
  const { versionId } = useParams()
  const id = Number(versionId)
  const navigate = useNavigate()
  const toast = useToast()

  const [detail, setDetail] = useState<VersionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<DetailTab>('unidades')
  const [recommendOpen, setRecommendOpen] = useState(false)
  const [acting, setActing] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseQuantity, setBaseQuantity] = useState('')
  const [baseDurationDays, setBaseDurationDays] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [savingHeader, setSavingHeader] = useState(false)
  const [savingUnit, setSavingUnit] = useState(false)
  const [headerError, setHeaderError] = useState<string | null>(null)

  const [units, setUnits] = useState<MeasurementUnit[]>([])
  const [positions, setPositions] = useState<PositionOption[]>([])
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])

  const version = detail?.version
  const isDraft = version?.status === 'draft'
  const isPublished = version?.status === 'published'

  const primaryUnit = useMemo(() => {
    if (!detail?.measurements.length) return null
    return (
      detail.measurements.find((item) => Number(item.isPrimary) === 1) ||
      detail.measurements[0] ||
      null
    )
  }, [detail])

  const unitLabel = primaryUnit
    ? [primaryUnit.unitSymbol, primaryUnit.unitName]
        .filter(Boolean)
        .join(' · ') || `Unidad #${primaryUnit.unitId}`
    : null


  useDocumentTitle(
    version
      ? `Quasar · ${version.templateCode || 'Versión'} v${version.versionNumber}`
      : 'Quasar · Versión',
  )

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setError('Versión inválida')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getTaskTemplateVersion(id)
      setDetail(data)
      setName(data.version.name)
      setDescription(data.version.description || '')
      setBaseQuantity(
        data.version.baseQuantity != null
          ? String(data.version.baseQuantity)
          : '',
      )
      setBaseDurationDays(
        data.version.baseDurationDays != null
          ? String(data.version.baseDurationDays)
          : '',
      )
      const primary =
        data.measurements.find((item) => Number(item.isPrimary) === 1) ||
        data.measurements[0] ||
        null
      setSelectedUnitId(primary ? String(primary.unitId) : '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la versión')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const reloadCatalog = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        listActivePositions(),
        listActiveSpecialties(),
      ])
      setPositions(p)
      setSpecialties(s)
      return { positions: p, specialties: s }
    } catch {
      return { positions: [] as PositionOption[], specialties: [] as SpecialtyOption[] }
    }
  }, [])

  useEffect(() => {
    void Promise.all([
      listActiveMeasurementUnits(),
      listActivePositions(),
      listActiveSpecialties(),
      listActiveTaskTemplates(),
    ])
      .then(([u, p, s, t]) => {
        setUnits(u)
        setPositions(p)
        setSpecialties(s)
        setTemplates(t)
      })
      .catch(() => {
        /* selects vacíos si falla */
      })
  }, [])

  const otherTemplates = useMemo(
    () =>
      templates.filter((t) => t.id !== version?.taskTemplateId),
    [templates, version?.taskTemplateId],
  )

  async function handlePrimaryUnitChange(unitIdValue: string) {
    if (!isDraft || !detail) return
    const previous = selectedUnitId
    setSelectedUnitId(unitIdValue)
    const unitId = Number(unitIdValue)
    if (!unitId) return

    setSavingUnit(true)
    setHeaderError(null)
    try {
      const existing = detail.measurements.find((item) => item.unitId === unitId)
      if (existing && Number(existing.isPrimary) === 1) return
      if (existing) {
        await deleteVersionMeasurement(existing.id)
      }
      await addVersionMeasurement(id, { unitId, isPrimary: 1 })
      toast.success('Unidad primaria actualizada')
      await load()
    } catch (err) {
      setSelectedUnitId(previous)
      setHeaderError(
        err instanceof Error ? err.message : 'No se pudo actualizar la unidad',
      )
    } finally {
      setSavingUnit(false)
    }
  }

  async function saveHeader(event: FormEvent) {
    event.preventDefault()
    if (!isDraft) return
    const qty = Number(baseQuantity)
    const days = Number(baseDurationDays)
    setSavingHeader(true)
    setHeaderError(null)
    try {
      await updateTaskTemplateVersion(id, {
        name: name.trim(),
        description: description.trim() || null,
        baseQuantity: Number.isFinite(qty) ? qty : null,
        baseDurationDays: Number.isFinite(days) ? days : null,
      })
      toast.success('Cabecera guardada')
      await load()
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSavingHeader(false)
    }
  }

  async function handlePublish() {
    setActing(true)
    try {
      await publishTaskTemplateVersion(id)
      toast.success('Versión publicada (inmutable)')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo publicar')
    } finally {
      setActing(false)
    }
  }

  async function handleArchive() {
    setActing(true)
    try {
      await archiveTaskTemplateVersion(id)
      toast.success('Versión archivada')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo archivar')
    } finally {
      setActing(false)
    }
  }

  async function handleNewVersion() {
    if (!version) return
    setActing(true)
    try {
      const created = await createTaskTemplateVersion({
        taskTemplateId: version.taskTemplateId,
        name: `${version.templateName || version.name} v${version.versionNumber + 1}`,
        description: version.description,
        baseQuantity:
          version.baseQuantity != null ? Number(version.baseQuantity) : null,
        baseDurationDays:
          version.baseDurationDays != null
            ? Number(version.baseDurationDays)
            : null,
        copyFromVersionId: version.id,
      })
      toast.success('Nueva versión draft clonada')
      navigate(`/maestros/task-pool/versiones/${created.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo clonar')
    } finally {
      setActing(false)
    }
  }

  if (loading && !detail) {
    return <p className={styles.empty}>Cargando versión…</p>
  }

  if (error && !detail) {
    return <Alert tone="error">{error}</Alert>
  }

  if (!detail || !version) return null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <button
            type="button"
            className={styles.back}
            onClick={() =>
              navigate(
                `/maestros/task-pool/plantillas/${version.taskTemplateId}`,
              )
            }
          >
            ← {version.templateCode || 'Actividad Registrada'}
          </button>
          <p className={styles.eyebrow}>
            {version.templateName} · v{version.versionNumber}
          </p>
          <h1 className={styles.title}>{version.name}</h1>
          <p className={styles.subtitle}>
            Editor de versión · {VERSION_STATUS_LABELS[version.status]}
            {unitLabel ? ` · Unidad ${unitLabel}` : ''}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Badge tone={statusTone(version.status)}>
            {VERSION_STATUS_LABELS[version.status]}
          </Badge>
          {isDraft ? (
            <Button disabled={acting} onClick={() => void handlePublish()}>
              Publicar
            </Button>
          ) : null}
          {isPublished ? (
            <>
              <Button
                variant="ghost"
                disabled={acting}
                onClick={() => setRecommendOpen(true)}
              >
                Recomendar
              </Button>
              <Button
                variant="danger"
                disabled={acting}
                onClick={() => void handleArchive()}
              >
                Archivar
              </Button>
            </>
          ) : null}
          {!isDraft ? (
            <Button
              variant="ghost"
              disabled={acting}
              onClick={() => void handleNewVersion()}
            >
              Nueva versión
            </Button>
          ) : null}
        </div>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className={styles.detailGrid}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Cabecera</h2>
          {!isDraft ? (
            <p className={styles.readonlyHint}>
              Solo lectura: las versiones publicadas o archivadas no se editan.
              Crea una nueva versión para iterar.
            </p>
          ) : null}
          <form className={styles.formGrid} onSubmit={saveHeader}>
            {headerError ? <Alert tone="error">{headerError}</Alert> : null}
            <Field
              label="Nombre"
              help="Nombre de la versión. Solo editable en borrador; al publicar queda fijo."
            >
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isDraft}
                required
              />
            </Field>
            <Field
              label="Unidad de medida"
              help="Elige primero la unidad (m³, m², und…). La cantidad base se interpreta en esa unidad. Queda como unidad primaria de la versión."
            >
              <TextSelect
                value={selectedUnitId}
                onChange={(e) => void handlePrimaryUnitChange(e.target.value)}
                disabled={!isDraft || savingUnit}
                required
              >
                <option value="">
                  {savingUnit ? 'Guardando…' : 'Seleccionar unidad…'}
                </option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.symbol} — {u.name}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <div className={styles.twoCol}>
              <Field
                label={
                  primaryUnit?.unitSymbol
                    ? `Cantidad base (${primaryUnit.unitSymbol})`
                    : 'Cantidad base'
                }
                help="Volumen de referencia en la unidad elegida arriba (ej. 100 m³). Debe ser > 0 para publicar."
              >
                <TextInput
                  type="number"
                  step="any"
                  value={baseQuantity}
                  onChange={(e) => setBaseQuantity(e.target.value)}
                  disabled={!isDraft || !selectedUnitId}
                  placeholder={
                    selectedUnitId
                      ? 'Ej. 100'
                      : 'Selecciona unidad primero'
                  }
                  required
                />
              </Field>
              <Field
                label="Duración base (días)"
                help="Días estimados para ejecutar la cantidad base. Debe ser > 0 para publicar."
              >
                <TextInput
                  type="number"
                  step="any"
                  value={baseDurationDays}
                  onChange={(e) => setBaseDurationDays(e.target.value)}
                  disabled={!isDraft}
                  required
                />
              </Field>
            </div>
            <Field
              label="Descripción"
              help="Notas de la versión: supuestos, cambios de rendimiento o alcance."
            >
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!isDraft}
                rows={3}
              />
            </Field>
            {isDraft ? (
              <Button type="submit" disabled={savingHeader}>
                {savingHeader ? 'Guardando…' : 'Guardar cabecera'}
              </Button>
            ) : null}
          </form>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Resumen</h2>
          <div className={styles.cardMeta} style={{ border: 0, padding: 0 }}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Código Actividad Registrada</span>
              <span className={styles.metaValue}>
                {version.templateCode || '—'}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Unidad primaria</span>
              <span className={styles.metaValue}>{unitLabel || 'Sin definir'}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Cantidad base</span>
              <span className={styles.metaValue}>
                {version.baseQuantity ?? '—'}
                {primaryUnit?.unitSymbol ? ` ${primaryUnit.unitSymbol}` : ''}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Unidades registradas</span>
              <span className={styles.metaValue}>
                {detail.measurements.length}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Cargos</span>
              <span className={styles.metaValue}>{detail.positions.length}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Subactividades</span>
              <span className={styles.metaValue}>{detail.subtasks.length}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Dependencias</span>
              <span className={styles.metaValue}>
                {detail.dependencies.length}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Detalle de versión">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={cn(styles.tab, tab === item.id && styles.tabActive)}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'unidades' ? (
        <UnidadesTab
          detail={detail}
          units={units}
          editable={isDraft}
          onChanged={load}
        />
      ) : null}
      {tab === 'cargos' ? (
        <CargosTab
          detail={detail}
          positions={positions}
          specialties={specialties}
          editable={isDraft}
          onChanged={load}
          onReloadCatalog={reloadCatalog}
        />
      ) : null}
      {tab === 'subactividades' ? (
        <SubactividadesTab
          detail={detail}
          editable={isDraft}
          onChanged={load}
        />
      ) : null}
      {tab === 'dependencias' ? (
        <DependenciasTab
          detail={detail}
          templates={otherTemplates}
          editable={isDraft}
          onChanged={load}
        />
      ) : null}

      <RecomendarModal
        open={recommendOpen}
        versionId={id}
        unitLabel={unitLabel}
        baseQuantity={version?.baseQuantity}
        baseDurationDays={version?.baseDurationDays}
        onClose={() => setRecommendOpen(false)}
      />
    </div>
  )
}

function UnidadesTab({
  detail,
  units,
  editable,
  onChanged,
}: {
  detail: VersionDetail
  units: MeasurementUnit[]
  editable: boolean
  onChanged: () => Promise<void>
}) {
  const toast = useToast()
  const [unitId, setUnitId] = useState('')
  const [isPrimary, setIsPrimary] = useState(true)
  const [saving, setSaving] = useState(false)

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const id = Number(unitId)
    if (!id) return
    setSaving(true)
    try {
      await addVersionMeasurement(detail.version.id, {
        unitId: id,
        isPrimary: isPrimary ? 1 : 0,
      })
      toast.success('Unidad agregada')
      setUnitId('')
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(itemId: number) {
    try {
      await deleteVersionMeasurement(itemId)
      toast.success('Unidad eliminada')
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar')
    }
  }

  return (
    <section className={styles.panel}>
      {editable ? (
        <form className={styles.inlineForm} onSubmit={handleAdd}>
          <Field
            label="Unidad de medida"
            help="Unidad en la que se mide la cantidad (m³, m², und…). Debe existir en el catálogo de unidades."
          >
            <TextSelect
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.symbol} — {u.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="Primaria"
            help="La unidad primaria es la principal de la versión. Si marcas Sí, las demás dejan de ser primarias."
          >
            <TextSelect
              value={isPrimary ? '1' : '0'}
              onChange={(e) => setIsPrimary(e.target.value === '1')}
            >
              <option value="1">Sí</option>
              <option value="0">No</option>
            </TextSelect>
          </Field>
          <div className={styles.inlineFormFull}>
            <Button type="submit" disabled={saving || !unitId}>
              {saving ? 'Agregando…' : 'Agregar unidad'}
            </Button>
          </div>
        </form>
      ) : (
        <p className={styles.readonlyHint}>Solo lectura</p>
      )}

      {detail.measurements.length === 0 ? (
        <p className={styles.muted}>Sin unidades.</p>
      ) : (
        <div className={styles.listStack}>
          {detail.measurements.map((item) => (
            <div key={item.id} className={styles.listItem}>
              <div className={styles.listItemBody}>
                <p className={styles.listItemTitle}>
                  {item.unitSymbol || '—'} · {item.unitName || `Unidad #${item.unitId}`}
                </p>
                <p className={styles.listItemMeta}>
                  {asFlag(item.isPrimary) ? 'Primaria' : 'Secundaria'}
                </p>
              </div>
              {editable ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleDelete(item.id)}
                >
                  Quitar
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function CargosTab({
  detail,
  positions,
  specialties,
  editable,
  onChanged,
  onReloadCatalog,
}: {
  detail: VersionDetail
  positions: PositionOption[]
  specialties: SpecialtyOption[]
  editable: boolean
  onChanged: () => Promise<void>
  onReloadCatalog: () => Promise<{
    positions: PositionOption[]
    specialties: SpecialtyOption[]
  }>
}) {
  const toast = useToast()
  const [workerPositionId, setWorkerPositionId] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [isRequired, setIsRequired] = useState(true)
  const [saving, setSaving] = useState(false)
  const [qtyDrafts, setQtyDrafts] = useState<Record<number, string>>({})
  const [savingQtyId, setSavingQtyId] = useState<number | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [newCargoName, setNewCargoName] = useState('')
  const [creatingCargo, setCreatingCargo] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [createSpecialtyOpen, setCreateSpecialtyOpen] = useState(false)
  const [newSpecialtyName, setNewSpecialtyName] = useState('')
  const [creatingSpecialty, setCreatingSpecialty] = useState(false)
  const [createSpecialtyError, setCreateSpecialtyError] = useState<string | null>(
    null,
  )

  const specialtyOptions = useMemo(() => {
    const posId = Number(workerPositionId)
    if (!posId) return []
    return specialties.filter(
      (item) =>
        item.workerPositionId == null || item.workerPositionId === posId,
    )
  }, [specialties, workerPositionId])

  useEffect(() => {
    const next: Record<number, string> = {}
    for (const item of detail.positions) {
      next[item.id] = String(item.quantity)
    }
    setQtyDrafts(next)
  }, [detail.positions])

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const posId = Number(workerPositionId)
    const qty = Number(quantity)
    const specId = specialtyId ? Number(specialtyId) : null
    if (!posId || !(qty > 0)) {
      toast.error('Cargo y cantidad > 0 son obligatorios')
      return
    }

    const already = detail.positions.find(
      (item) =>
        item.workerPositionId === posId &&
        (item.specialtyId ?? null) === specId,
    )
    if (already) {
      toast.error(
        'Ese cargo ya está agregado. Cambia la cantidad en la lista de abajo.',
      )
      return
    }

    setSaving(true)
    try {
      await addVersionPosition(detail.version.id, {
        workerPositionId: posId,
        specialtyId: specId,
        quantity: qty,
        isRequired: isRequired ? 1 : 0,
      })
      toast.success('Cargo agregado')
      setWorkerPositionId('')
      setSpecialtyId('')
      setQuantity('1')
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveQuantity(itemId: number) {
    const qty = Number(qtyDrafts[itemId])
    if (!(qty > 0)) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }
    setSavingQtyId(itemId)
    try {
      await updateVersionPosition(itemId, { quantity: qty })
      toast.success('Cantidad actualizada')
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar')
    } finally {
      setSavingQtyId(null)
    }
  }

  async function handleDelete(itemId: number) {
    try {
      await deleteVersionPosition(itemId)
      toast.success('Cargo eliminado')
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar')
    }
  }

  async function handleCreateCargo(event: FormEvent) {
    event.preventDefault()
    const name = newCargoName.trim()
    if (!name) {
      setCreateError('El nombre es obligatorio.')
      return
    }
    setCreatingCargo(true)
    setCreateError(null)
    try {
      const created = await createPosition(name)
      const refreshed = await onReloadCatalog()
      const selected =
        refreshed.positions.find((item) => item.id === created.id) || created
      setWorkerPositionId(String(selected.id))
      setSpecialtyId('')
      setCreateOpen(false)
      setNewCargoName('')
      toast.success('Cargo creado y seleccionado')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCreateError('Ese nombre de cargo ya existe.')
      } else {
        setCreateError(err instanceof Error ? err.message : 'No se pudo crear')
      }
    } finally {
      setCreatingCargo(false)
    }
  }

  async function handleCreateSpecialty(event: FormEvent) {
    event.preventDefault()
    const name = newSpecialtyName.trim()
    const posId = Number(workerPositionId)
    if (!name) {
      setCreateSpecialtyError('El nombre es obligatorio.')
      return
    }
    if (!posId) {
      setCreateSpecialtyError('Selecciona un cargo primero.')
      return
    }
    setCreatingSpecialty(true)
    setCreateSpecialtyError(null)
    try {
      const created = await createSpecialty({
        name,
        workerPositionId: posId,
      })
      await onReloadCatalog()
      setSpecialtyId(String(created.id))
      setCreateSpecialtyOpen(false)
      setNewSpecialtyName('')
      toast.success('Especialidad creada y seleccionada')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCreateSpecialtyError('Esa especialidad ya existe.')
      } else {
        setCreateSpecialtyError(
          err instanceof Error ? err.message : 'No se pudo crear',
        )
      }
    } finally {
      setCreatingSpecialty(false)
    }
  }

  const selectedCargoName =
    positions.find((item) => String(item.id) === workerPositionId)?.name ||
    'cargo seleccionado'

  return (
    <section className={styles.panel}>
      {editable ? (
        <form className={styles.inlineForm} onSubmit={handleAdd}>
          <div className={`${styles.inlineFormFull} ${styles.cargoSelectRow}`}>
            <Field
              label="Cargo"
              help="Rol laboral recomendado para estimar gente (ej. Oficial). No limita quién puede trabajar esa actividad en campo."
            >
              <TextSelect
                value={workerPositionId}
                onChange={(e) => {
                  setWorkerPositionId(e.target.value)
                  setSpecialtyId('')
                }}
                required
              >
                <option value="">Seleccionar…</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Button
              type="button"
              variant="ghost"
              className={styles.cargoCreateBtn}
              onClick={() => {
                setNewCargoName('')
                setCreateError(null)
                setCreateOpen(true)
              }}
            >
              Nuevo cargo
            </Button>
          </div>
          <div className={`${styles.inlineFormFull} ${styles.cargoSelectRow}`}>
            <Field
              label="Especialidad"
              help="Opcional y solo para recomendación. En obra real no bloquea asignar a alguien de otra especialidad (ej. oficial de plomería en obra civil)."
            >
              <TextSelect
                value={specialtyId}
                onChange={(e) => setSpecialtyId(e.target.value)}
                disabled={!workerPositionId}
              >
                <option value="">Sin especialidad</option>
                {specialtyOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Button
              type="button"
              variant="ghost"
              className={styles.cargoCreateBtn}
              disabled={!workerPositionId}
              title={
                workerPositionId
                  ? 'Crear especialidad para este cargo'
                  : 'Selecciona un cargo primero'
              }
              onClick={() => {
                setNewSpecialtyName('')
                setCreateSpecialtyError(null)
                setCreateSpecialtyOpen(true)
              }}
            >
              Nueva especialidad
            </Button>
          </div>
          <Field
            label="Cantidad"
            help="Cuántas personas de este cargo hacen falta para la cantidad base de la versión. Si el cargo ya existe, edítalo en la lista."
          >
            <TextInput
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Requerido"
            help="Si es requerido, el cargo se considera indispensable en la recomendación y en obra (Fase 6)."
          >
            <TextSelect
              value={isRequired ? '1' : '0'}
              onChange={(e) => setIsRequired(e.target.value === '1')}
            >
              <option value="1">Sí</option>
              <option value="0">No</option>
            </TextSelect>
          </Field>
          <div className={styles.inlineFormFull}>
            <Button type="submit" disabled={saving}>
              {saving ? 'Agregando…' : 'Agregar cargo'}
            </Button>
          </div>
        </form>
      ) : (
        <p className={styles.readonlyHint}>Solo lectura</p>
      )}

      {detail.positions.length === 0 ? (
        <p className={styles.muted}>Sin cargos.</p>
      ) : (
        <div className={styles.listStack}>
          {detail.positions.map((item) => (
            <div key={item.id} className={styles.listItem}>
              <div className={styles.listItemBody}>
                <p className={styles.listItemTitle}>
                  {item.positionName || `Cargo #${item.workerPositionId}`}
                  {item.specialtyName ? ` · ${item.specialtyName}` : ''}
                </p>
                <p className={styles.listItemMeta}>
                  {asFlag(item.isRequired) ? 'Requerido' : 'Opcional'}
                  {!item.specialtyName ? ' · sin especialidad' : ''}
                </p>
                {editable ? (
                  <div className={styles.qtyRow}>
                    <Field
                      label="Cantidad"
                      help="Personas de este cargo para la cantidad base. Un solo registro por cargo + especialidad."
                    >
                      <TextInput
                        type="number"
                        step="any"
                        min="0"
                        value={qtyDrafts[item.id] ?? String(item.quantity)}
                        onChange={(e) =>
                          setQtyDrafts((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Button
                      size="sm"
                      disabled={
                        savingQtyId === item.id ||
                        String(item.quantity) ===
                          (qtyDrafts[item.id] ?? String(item.quantity))
                      }
                      onClick={() => void handleSaveQuantity(item.id)}
                    >
                      {savingQtyId === item.id ? '…' : 'Guardar'}
                    </Button>
                  </div>
                ) : (
                  <p className={styles.listItemMeta}>Cantidad {item.quantity}</p>
                )}
              </div>
              {editable ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleDelete(item.id)}
                >
                  Quitar
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Modal
        title="Nuevo cargo"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-cargo-from-pool"
              disabled={creatingCargo}
            >
              {creatingCargo ? 'Creando…' : 'Crear'}
            </Button>
          </>
        }
      >
        <form
          id="create-cargo-from-pool"
          className={styles.formGrid}
          onSubmit={handleCreateCargo}
        >
          {createError ? <Alert tone="error">{createError}</Alert> : null}
          <Field
            label="Nombre"
            help="Se crea en el catálogo de RRHH (ej. Oficial, Ayudante) y queda disponible aquí."
          >
            <TextInput
              value={newCargoName}
              onChange={(e) => setNewCargoName(e.target.value)}
              placeholder="ej. Oficial"
              required
              autoFocus
            />
          </Field>
        </form>
      </Modal>

      <Modal
        title="Nueva especialidad"
        open={createSpecialtyOpen}
        onClose={() => setCreateSpecialtyOpen(false)}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setCreateSpecialtyOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-specialty-from-pool"
              disabled={creatingSpecialty}
            >
              {creatingSpecialty ? 'Creando…' : 'Crear'}
            </Button>
          </>
        }
      >
        <form
          id="create-specialty-from-pool"
          className={styles.formGrid}
          onSubmit={handleCreateSpecialty}
        >
          {createSpecialtyError ? (
            <Alert tone="error">{createSpecialtyError}</Alert>
          ) : null}
          <p className={styles.noteBox}>
            Se vinculará al cargo <strong>{selectedCargoName}</strong>.
          </p>
          <Field
            label="Nombre"
            help="Ej. Estructura, Eléctrico, Plomería. Queda en el catálogo de RRHH ligada a este cargo."
          >
            <TextInput
              value={newSpecialtyName}
              onChange={(e) => setNewSpecialtyName(e.target.value)}
              placeholder="ej. Estructura"
              required
              autoFocus
            />
          </Field>
        </form>
      </Modal>
    </section>
  )
}

function SubactividadesTab({
  detail,
  editable,
  onChanged,
}: {
  detail: VersionDetail
  editable: boolean
  onChanged: () => Promise<void>
}) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [displayOrder, setDisplayOrder] = useState('1')
  const [weightPercent, setWeightPercent] = useState('0')
  const [isRequired, setIsRequired] = useState(true)
  const [saving, setSaving] = useState(false)

  const weightSum = detail.subtasks.reduce(
    (acc, item) => acc + Number(item.weightPercent || 0),
    0,
  )

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    const weight = Number(weightPercent)
    if (Number.isNaN(weight) || weight < 0 || weight > 100) {
      toast.error('El % de la subactividad debe estar entre 0 y 100')
      return
    }
    setSaving(true)
    try {
      await addVersionSubtask(detail.version.id, {
        name: name.trim(),
        description: description.trim() || null,
        displayOrder: Number(displayOrder) || 1,
        isRequired: isRequired ? 1 : 0,
        weightPercent: weight,
      })
      toast.success('Subactividad agregada')
      setName('')
      setDescription('')
      setDisplayOrder(String(detail.subtasks.length + 2))
      setWeightPercent('0')
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(itemId: number) {
    try {
      await deleteVersionSubtask(itemId)
      toast.success('Subactividad eliminada')
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar')
    }
  }

  async function toggleRequired(itemId: number, current: unknown) {
    try {
      await updateVersionSubtask(itemId, {
        isRequired: asFlag(current) ? 0 : 1,
      })
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar')
    }
  }

  async function saveWeight(itemId: number, value: string) {
    const weight = Number(value)
    if (Number.isNaN(weight) || weight < 0 || weight > 100) {
      toast.error('El % debe estar entre 0 y 100')
      return
    }
    try {
      await updateVersionSubtask(itemId, { weightPercent: weight })
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar')
    }
  }

  return (
    <section className={styles.panel}>
      <p className={styles.muted}>
        Cada subactividad aporta un % al 100% de la actividad. Suma actual:{' '}
        <strong>{weightSum.toFixed(1)}%</strong>
        {Math.abs(weightSum - 100) > 0.05
          ? ' (debe ser 100 antes de publicar)'
          : ' ✓'}
      </p>
      {editable ? (
        <form className={styles.inlineForm} onSubmit={handleAdd}>
          <Field
            label="Nombre"
            help="Nombre del paso estándar dentro de la actividad (ej. Armado de formaleta)."
          >
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Orden"
            help="Orden de aparición de la subactividad (1, 2, 3…). Menor número = primero."
          >
            <TextInput
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
            />
          </Field>
          <Field
            label="% de la actividad"
            help="Cuánto aporta esta subactividad al 100% de la actividad."
          >
            <TextInput
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={weightPercent}
              onChange={(e) => setWeightPercent(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Requerida"
            help="Si es requerida, el paso no debería omitirse al ejecutar la actividad en obra."
          >
            <TextSelect
              value={isRequired ? '1' : '0'}
              onChange={(e) => setIsRequired(e.target.value === '1')}
            >
              <option value="1">Sí</option>
              <option value="0">No</option>
            </TextSelect>
          </Field>
          <Field
            label="Descripción"
            className={styles.inlineFormFull}
            help="Detalle opcional de cómo se realiza este paso."
          >
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
          <div className={styles.inlineFormFull}>
            <Button type="submit" disabled={saving}>
              {saving ? 'Agregando…' : 'Agregar subactividad'}
            </Button>
          </div>
        </form>
      ) : (
        <p className={styles.readonlyHint}>Solo lectura</p>
      )}

      {detail.subtasks.length === 0 ? (
        <p className={styles.muted}>Sin subactividades.</p>
      ) : (
        <div className={styles.listStack}>
          {[...detail.subtasks]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((item) => (
              <div key={item.id} className={styles.listItem}>
                <div className={styles.listItemBody}>
                  <p className={styles.listItemTitle}>
                    {item.displayOrder}. {item.name} · {Number(item.weightPercent || 0)}%
                  </p>
                  <p className={styles.listItemMeta}>
                    {item.description || 'Sin descripción'}
                    {asFlag(item.isRequired) ? ' · requerida' : ''}
                  </p>
                  {editable ? (
                    <div className={styles.inlineForm} style={{ marginTop: '0.5rem' }}>
                      <Field label="Editar %">
                        <TextInput
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          defaultValue={String(item.weightPercent ?? 0)}
                          onBlur={(e) => {
                            if (
                              String(e.target.value) !==
                              String(item.weightPercent ?? 0)
                            ) {
                              void saveWeight(item.id, e.target.value)
                            }
                          }}
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
                {editable ? (
                  <div className={styles.rowActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggleRequired(item.id, item.isRequired)}
                    >
                      {asFlag(item.isRequired) ? 'Opcional' : 'Requerida'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void handleDelete(item.id)}
                    >
                      Quitar
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
        </div>
      )}
    </section>
  )
}

function DependenciasTab({
  detail,
  templates,
  editable,
  onChanged,
}: {
  detail: VersionDetail
  templates: TaskTemplate[]
  editable: boolean
  onChanged: () => Promise<void>
}) {
  const toast = useToast()
  const [dependsOnTemplateId, setDependsOnTemplateId] = useState('')
  const [dependencyType, setDependencyType] =
    useState<DependencyType>('finish_to_start')
  const [isRequired, setIsRequired] = useState(true)
  const [blocksStart, setBlocksStart] = useState(true)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const tplId = Number(dependsOnTemplateId)
    if (!tplId) return
    setSaving(true)
    try {
      await addVersionDependency(detail.version.id, {
        dependsOnTemplateId: tplId,
        dependencyType,
        isRequired: isRequired ? 1 : 0,
        blocksStart: blocksStart ? 1 : 0,
        description: description.trim() || null,
      })
      toast.success('Dependencia agregada')
      setDependsOnTemplateId('')
      setDescription('')
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(itemId: number) {
    try {
      await deleteVersionDependency(itemId)
      toast.success('Dependencia eliminada')
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar')
    }
  }

  return (
    <section className={styles.panel}>
      {editable ? (
        <form className={styles.inlineForm} onSubmit={handleAdd}>
          <Field
            label="Depende de Actividad Registrada"
            help="Otra Actividad Registrada que debe relacionarse con esta (no una versión concreta). En obra se resolverá con la versión vigente."
          >
            <TextSelect
              value={dependsOnTemplateId}
              onChange={(e) => setDependsOnTemplateId(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="Tipo"
            help="Relación temporal: Fin→Inicio (default), Inicio→Inicio, Fin→Fin o Inicio→Fin."
          >
            <TextSelect
              value={dependencyType}
              onChange={(e) =>
                setDependencyType(e.target.value as DependencyType)
              }
            >
              {(Object.keys(DEPENDENCY_TYPE_LABELS) as DependencyType[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {DEPENDENCY_TYPE_LABELS[key]}
                  </option>
                ),
              )}
            </TextSelect>
          </Field>
          <Field
            label="Requerida"
            help="Si es requerida, la dependencia no debería ignorarse al planificar la obra."
          >
            <TextSelect
              value={isRequired ? '1' : '0'}
              onChange={(e) => setIsRequired(e.target.value === '1')}
            >
              <option value="1">Sí</option>
              <option value="0">No</option>
            </TextSelect>
          </Field>
          <Field
            label="Bloquea inicio"
            help="Si es Sí, esta actividad no debería empezar hasta cumplir la dependencia."
          >
            <TextSelect
              value={blocksStart ? '1' : '0'}
              onChange={(e) => setBlocksStart(e.target.value === '1')}
            >
              <option value="1">Sí</option>
              <option value="0">No</option>
            </TextSelect>
          </Field>
          <Field
            label="Descripción"
            className={styles.inlineFormFull}
            help="Nota opcional que explica por qué existe esta dependencia."
          >
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
          <div className={styles.inlineFormFull}>
            <Button type="submit" disabled={saving}>
              {saving ? 'Agregando…' : 'Agregar dependencia'}
            </Button>
          </div>
        </form>
      ) : (
        <p className={styles.readonlyHint}>Solo lectura</p>
      )}

      {detail.dependencies.length === 0 ? (
        <p className={styles.muted}>Sin dependencias.</p>
      ) : (
        <div className={styles.listStack}>
          {detail.dependencies.map((item) => (
            <div key={item.id} className={styles.listItem}>
              <div className={styles.listItemBody}>
                <p className={styles.listItemTitle}>
                  {item.dependsOnTemplateCode ||
                    item.dependsOnTemplateName ||
                    `Actividad Registrada #${item.dependsOnTemplateId}`}
                </p>
                <p className={styles.listItemMeta}>
                  {DEPENDENCY_TYPE_LABELS[item.dependencyType] ||
                    item.dependencyType}
                  {asFlag(item.isRequired) ? ' · requerida' : ''}
                  {asFlag(item.blocksStart) ? ' · bloquea inicio' : ''}
                  {item.description ? ` · ${item.description}` : ''}
                </p>
              </div>
              {editable ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleDelete(item.id)}
                >
                  Quitar
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
