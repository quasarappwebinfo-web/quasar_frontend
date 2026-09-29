import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { listTaskTemplates } from '@/task-pool/api/plantillasApi'
import { recommendFromVersion } from '@/task-pool/api/versionesApi'
import { listTaskTemplateVersions } from '@/task-pool/api/versionesApi'
import type {
  RecommendationResult,
  TaskTemplate,
  TaskTemplateVersion,
} from '@/task-pool/model/types'
import { VERSION_STATUS_LABELS } from '@/task-pool/model/types'
import { createTaskFromTemplate } from '@/tareas/api/tareasApi'
import { ApiError } from '@/shared/api/apiJson'
import {
  Alert,
  Button,
  Field,
  Modal,
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
import styles from './tareas.module.css'

type CreateTaskFromTemplateModalProps = {
  open: boolean
  obraId: number
  onClose: () => void
  onCreated: () => void
}

export function CreateTaskFromTemplateModal({
  open,
  obraId,
  onClose,
  onCreated,
}: CreateTaskFromTemplateModalProps) {
  const toast = useToast()
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [versions, setVersions] = useState<TaskTemplateVersion[]>([])
  const [templateId, setTemplateId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [plannedQuantity, setPlannedQuantity] = useState('100')
  const [approvedDurationDays, setApprovedDurationDays] = useState('')
  const [plannedStartDate, setPlannedStartDate] = useState('')
  const [plannedEndDate, setPlannedEndDate] = useState('')
  const [name, setName] = useState('')
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(
    null,
  )
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [versionsError, setVersionsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setVersionsError(null)
    setRecommendation(null)
    setTemplateId('')
    setVersionId('')
    setVersions([])
    setPlannedQuantity('100')
    setApprovedDurationDays('')
    setPlannedStartDate('')
    setPlannedEndDate('')
    setName('')
    void listTaskTemplates({ page: 1, activeOnly: true })
      .then((data) => setTemplates(data.templates))
      .catch(() => setTemplates([]))
  }, [open])

  useEffect(() => {
    if (!templateId) {
      setVersions([])
      setVersionId('')
      setVersionsError(null)
      return
    }
    setLoadingMeta(true)
    setVersionsError(null)
    void listTaskTemplateVersions({
      page: 1,
      templateId: Number(templateId),
    })
      .then((data) => {
        const all = data.versions
        setVersions(all)
        const published = all.filter((item) => item.status === 'published')
        setVersionId(published[0] ? String(published[0].id) : '')
        if (published.length === 0) {
          setVersionsError(
            all.length === 0
              ? 'Esta Actividad Registrada no tiene versiones. Crea y publica una en Base Datos Actividades.'
              : `Hay ${all.length} versión(es), pero ninguna publicada. Solo se puede crear actividad desde published.`,
          )
        }
      })
      .catch((err) => {
        setVersions([])
        setVersionId('')
        setVersionsError(
          err instanceof Error ? err.message : 'No se pudieron cargar versiones',
        )
      })
      .finally(() => setLoadingMeta(false))
  }, [templateId])

  const publishedVersions = useMemo(
    () => versions.filter((item) => item.status === 'published'),
    [versions],
  )

  const selectedVersion = useMemo(
    () => publishedVersions.find((item) => String(item.id) === versionId) || null,
    [publishedVersions, versionId],
  )

  useEffect(() => {
    if (!selectedVersion || !plannedQuantity) {
      setRecommendation(null)
      return
    }
    const qty = Number(plannedQuantity)
    if (!(qty > 0)) return
    const timer = window.setTimeout(() => {
      void recommendFromVersion(selectedVersion.id, qty)
        .then((data) => {
          setRecommendation(data)
          setApprovedDurationDays((current) =>
            current ? current : String(data.recommendedDurationDays),
          )
        })
        .catch(() => setRecommendation(null))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [selectedVersion, plannedQuantity])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const sourceTemplateVersionId = Number(versionId)
    const qty = Number(plannedQuantity)
    const approved = approvedDurationDays ? Number(approvedDurationDays) : null
    if (!sourceTemplateVersionId || !(qty > 0)) {
      setError(
        publishedVersions.length === 0
          ? 'Necesitas una versión publicada de la Actividad Registrada para continuar.'
          : 'Actividad Registrada publicada y cantidad de obra son obligatorias.',
      )
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createTaskFromTemplate({
        obraId,
        sourceTemplateVersionId,
        plannedQuantity: qty,
        approvedDurationDays: approved && approved > 0 ? approved : null,
        plannedStartDate: plannedStartDate || null,
        plannedEndDate: plannedEndDate || null,
        name: name.trim() || null,
        copySubtasks: true,
        instantiateDependencies: true,
      })
      toast.success('Actividad creada en Programadas')
      onCreated()
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo crear')
      }
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = Boolean(selectedVersion) && !saving && !loadingMeta

  return (
    <Modal
      title="Nueva actividad desde Actividad Registrada"
      open={open}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="create-task-template" disabled={!canSubmit}>
            {saving ? 'Creando…' : 'Crear en Programadas'}
          </Button>
        </>
      }
    >
      <form id="create-task-template" className={styles.formGrid} onSubmit={handleSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className={styles.noteBox}>
          El sistema recomienda duración y cargos. Tú apruebas la duración y las
          fechas. La actividad nace siempre en <strong>Programadas</strong>. Solo
          versiones <strong>publicadas</strong> de la Base Datos Actividades.
        </div>
        <Field label="Actividad Registrada" help="Solo Actividades Registradas activas de la Base Datos Actividades.">
          <TextSelect
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            required
          >
            <option value="">Seleccionar…</option>
            {templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.name}
              </option>
            ))}
          </TextSelect>
        </Field>
        <Field
          label="Versión published"
          help="Si no ves opciones, publica la versión en Configuración Global → Base Datos Actividades."
        >
          <TextSelect
            value={versionId}
            onChange={(e) => {
              setVersionId(e.target.value)
              setApprovedDurationDays('')
            }}
            disabled={!templateId || loadingMeta || publishedVersions.length === 0}
            required={publishedVersions.length > 0}
          >
            <option value="">
              {loadingMeta
                ? 'Cargando…'
                : publishedVersions.length === 0
                  ? 'Sin versiones publicadas'
                  : 'Seleccionar versión…'}
            </option>
            {publishedVersions.map((item) => (
              <option key={item.id} value={item.id}>
                v{item.versionNumber} · {item.name}
              </option>
            ))}
          </TextSelect>
        </Field>
        {versionsError ? (
          <div className={styles.formGrid}>
            <Alert tone="error">{versionsError}</Alert>
            <p className={styles.hint}>
              {templateId ? (
                <Link to={`/maestros/task-pool/plantillas/${templateId}`}>
                  Ir a la Actividad Registrada →
                </Link>
              ) : (
                <Link to="/maestros/task-pool/plantillas">Ir a Base Datos Actividades →</Link>
              )}
            </p>
          </div>
        ) : null}
        {versions.length > 0 && publishedVersions.length === 0 ? (
          <ul className={styles.blockList}>
            {versions.map((item) => (
              <li key={item.id} className={styles.blockItem}>
                <p className={styles.blockTitle}>
                  v{item.versionNumber} · {item.name}
                </p>
                <p className={styles.blockText}>
                  Estado: {VERSION_STATUS_LABELS[item.status] || item.status} —
                  no usable hasta publicar.
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        <div className={styles.twoCol}>
          <Field
            label="Cantidad de obra"
            help="Misma unidad que la Actividad Registrada. Escala la recomendación."
          >
            <TextInput
              type="number"
              step="any"
              value={plannedQuantity}
              onChange={(e) => {
                setPlannedQuantity(e.target.value)
                setApprovedDurationDays('')
              }}
              required
            />
          </Field>
          <Field
            label="Duración aprobada (días)"
            help="Puedes ajustar la recomendación del sistema."
          >
            <TextInput
              type="number"
              step="any"
              value={approvedDurationDays}
              onChange={(e) => setApprovedDurationDays(e.target.value)}
              placeholder={
                recommendation
                  ? `Recomendado: ${recommendation.recommendedDurationDays}`
                  : '—'
              }
            />
          </Field>
        </div>
        {recommendation ? (
          <div className={styles.noteBox}>
            Recomendado: <strong>{recommendation.recommendedDurationDays}</strong>{' '}
            días (factor {recommendation.scaleFactor}).{' '}
            {recommendation.recommendedPositions.length
              ? `Cargos: ${recommendation.recommendedPositions
                  .map(
                    (p) =>
                      `${p.positionName || 'Cargo'} × ${p.recommendedQuantity}`,
                  )
                  .join(', ')}.`
              : null}
          </div>
        ) : null}
        <div className={styles.twoCol}>
          <Field label="Inicio planificado">
            <TextInput
              type="date"
              value={plannedStartDate}
              onChange={(e) => setPlannedStartDate(e.target.value)}
            />
          </Field>
          <Field label="Fin planificado">
            <TextInput
              type="date"
              value={plannedEndDate}
              onChange={(e) => setPlannedEndDate(e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Nombre (opcional)"
          help="Si lo dejas vacío, usa el de la Actividad Registrada."
        >
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              selectedVersion?.templateName || selectedVersion?.name || ''
            }
          />
        </Field>
      </form>
    </Modal>
  )
}
