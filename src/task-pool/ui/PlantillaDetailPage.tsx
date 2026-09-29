import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getTaskTemplate } from '@/task-pool/api/plantillasApi'
import {
  createTaskTemplateVersion,
  getTaskTemplateVersion,
  listTaskTemplateVersions,
} from '@/task-pool/api/versionesApi'
import type { TaskTemplate, TaskTemplateVersion } from '@/task-pool/model/types'
import {
  VERSION_STATUS_LABELS,
  type VersionStatus,
} from '@/task-pool/model/types'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
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
import styles from './taskPool.module.css'

function statusTone(status: VersionStatus): 'neutral' | 'success' | 'danger' {
  if (status === 'published') return 'success'
  if (status === 'archived') return 'danger'
  return 'neutral'
}

type VersionCard = TaskTemplateVersion & {
  primaryUnitLabel: string | null
}

function primaryUnitFromDetail(measurements: {
  unitSymbol: string | null
  unitName: string | null
  unitId: number
  isPrimary: number | 0 | 1
}[]): string | null {
  if (!measurements.length) return null
  const primary =
    measurements.find((item) => Number(item.isPrimary) === 1) || measurements[0]
  if (!primary) return null
  return (
    [primary.unitSymbol, primary.unitName].filter(Boolean).join(' · ') ||
    `Unidad #${primary.unitId}`
  )
}

export function PlantillaDetailPage() {
  const { templateId } = useParams()
  const id = Number(templateId)
  const navigate = useNavigate()
  const toast = useToast()

  const [template, setTemplate] = useState<TaskTemplate | null>(null)
  const [versions, setVersions] = useState<VersionCard[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseQuantity, setBaseQuantity] = useState('100')
  const [baseDurationDays, setBaseDurationDays] = useState('5')
  const [copyFromVersionId, setCopyFromVersionId] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useDocumentTitle(
    template ? `Quasar · ${template.code}` : 'Quasar · Actividad Registrada',
  )

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setError('Actividad Registrada inválida')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [tpl, versionsData] = await Promise.all([
        getTaskTemplate(id),
        listTaskTemplateVersions({
          page,
          templateId: id,
          status: (statusFilter || undefined) as VersionStatus | undefined,
        }),
      ])
      const enriched = await Promise.all(
        versionsData.versions.map(async (version) => {
          try {
            const detail = await getTaskTemplateVersion(version.id)
            return {
              ...version,
              primaryUnitLabel: primaryUnitFromDetail(detail.measurements),
            }
          } catch {
            return { ...version, primaryUnitLabel: null }
          }
        }),
      )
      setTemplate(tpl)
      setVersions(enriched)
      setTotalItems(versionsData.pagination.totalItems)
      setItemsPerPage(versionsData.pagination.itemsPerPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la Actividad Registrada')
    } finally {
      setLoading(false)
    }
  }, [id, page, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setName(template ? `${template.name} v${versions.length + 1}` : '')
    setDescription('')
    setBaseQuantity('100')
    setBaseDurationDays('5')
    setCopyFromVersionId('')
    setFormError(null)
    setModalOpen(true)
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    const qty = Number(baseQuantity)
    const days = Number(baseDurationDays)
    if (!name.trim()) {
      setFormError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const created = await createTaskTemplateVersion({
        taskTemplateId: id,
        name: name.trim(),
        description: description.trim() || null,
        baseQuantity: Number.isFinite(qty) ? qty : null,
        baseDurationDays: Number.isFinite(days) ? days : null,
        copyFromVersionId: copyFromVersionId
          ? Number(copyFromVersionId)
          : null,
      })
      toast.success('Versión draft creada')
      setModalOpen(false)
      navigate(`/maestros/task-pool/versiones/${created.id}`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !template) {
    return <p className={styles.empty}>Cargando Actividad Registrada…</p>
  }

  if (error && !template) {
    return <Alert tone="error">{error}</Alert>
  }

  if (!template) return null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate('/maestros/task-pool/plantillas')}
          >
            ← Actividades Registradas
          </button>
          <p className={styles.eyebrow}>{template.code}</p>
          <h1 className={styles.title}>{template.name}</h1>
          <p className={styles.subtitle}>
            {template.categoryName || 'Sin categoría'}
            {template.zoneName ? ` · ${template.zoneName}` : ''}
            {template.budgetActivityName
              ? ` · ${template.budgetActivityName}`
              : ''}
            {template.description ? ` · ${template.description}` : ''}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button onClick={openCreate}>Nueva versión</Button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Field
            label="Estado"
            help="Filtra versiones por ciclo de vida: borrador (editable), publicada (usable) o archivada (histórico)."
          >
            <TextSelect
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Todos</option>
              <option value="draft">Borrador</option>
              <option value="published">Publicada</option>
              <option value="archived">Archivada</option>
            </TextSelect>
          </Field>
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando versiones…</p>
      ) : versions.length === 0 ? (
        <p className={styles.empty}>
          Aún no hay versiones. Crea un draft para empezar.
        </p>
      ) : (
        <div className={styles.cardGrid}>
          {versions.map((version) => (
            <article key={version.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.cardTitle}>{version.name}</h3>
                  <p className={styles.cardSubtitle}>
                    Versión {version.versionNumber}
                  </p>
                </div>
                <Badge tone={statusTone(version.status)}>
                  {VERSION_STATUS_LABELS[version.status]}
                </Badge>
              </div>
              <div className={styles.cardMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Cantidad base</span>
                  <span className={styles.metaValue}>
                    {version.baseQuantity ?? '—'}
                    {version.primaryUnitLabel
                      ? ` ${version.primaryUnitLabel.split(' · ')[0]}`
                      : ''}
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Unidad</span>
                  <span className={styles.metaValue}>
                    {version.primaryUnitLabel || 'Sin definir'}
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Duración base (días)</span>
                  <span className={styles.metaValue}>
                    {version.baseDurationDays ?? '—'}
                  </span>
                </div>
              </div>
              <div className={styles.rowActions}>
                <Button
                  size="sm"
                  onClick={() =>
                    navigate(`/maestros/task-pool/versiones/${version.id}`)
                  }
                >
                  Abrir editor
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
        title="Nueva versión (draft)"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="new-version-form" disabled={saving}>
              {saving ? 'Creando…' : 'Crear draft'}
            </Button>
          </>
        }
      >
        <form id="new-version-form" className={styles.formGrid} onSubmit={handleCreate}>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field
            label="Nombre"
            help="Nombre de esta versión (ej. Vaciado de losa v1). Puede diferenciar iteraciones."
          >
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <div className={styles.twoCol}>
            <Field
              label="Cantidad base"
              help="Volumen de referencia con el que se calibró la Actividad Registrada (ej. 100). Al recomendar, se escala según la cantidad real de la obra."
            >
              <TextInput
                type="number"
                step="any"
                value={baseQuantity}
                onChange={(e) => setBaseQuantity(e.target.value)}
              />
            </Field>
            <Field
              label="Duración base (días)"
              help="Días que toma ejecutar esa cantidad base. Al recomendar se multiplica por el factor cantidad obra ÷ cantidad base."
            >
              <TextInput
                type="number"
                step="any"
                value={baseDurationDays}
                onChange={(e) => setBaseDurationDays(e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Clonar desde versión (opcional)"
            help="Copia unidades, cargos, subactividades y dependencias de otra versión. Ideal para iterar sin empezar de cero."
          >
            <TextSelect
              value={copyFromVersionId}
              onChange={(e) => setCopyFromVersionId(e.target.value)}
            >
              <option value="">Empezar vacío</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} · {v.name} ({VERSION_STATUS_LABELS[v.status]})
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="Descripción"
            help="Notas de esta versión (cambios de rendimiento, supuestos, etc.)."
          >
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
