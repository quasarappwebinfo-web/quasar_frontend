import { useEffect, useState, type FormEvent } from 'react'
import {
  listActiveSaleTypes,
  listActiveStages,
} from '@/obras/api/catalogosObrasApi'
import {
  createObra,
  deleteObraCover,
  updateObra,
  uploadObraCover,
} from '@/obras/api/obrasApi'
import {
  OBRA_COVER_ACCEPT,
  OBRA_STATUS_OPTIONS,
  resolveObraCover,
  validateObraCoverFile,
} from '@/obras/lib/obraUi'
import type { Obra, SaleTypeOption, StageOption } from '@/obras/model/types'
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
import styles from './DashboardPage.module.css'

type ObraFormModalProps = {
  open: boolean
  obra: Obra | null
  onClose: () => void
  onSaved: (obra: Obra) => void
}

export function ObraFormModal({ open, obra, onClose, onSaved }: ObraFormModalProps) {
  const toast = useToast()
  const editing = Boolean(obra)
  const [saleTypes, setSaleTypes] = useState<SaleTypeOption[]>([])
  const [stages, setStages] = useState<StageOption[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [saleTypeId, setSaleTypeId] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [startDate, setStartDate] = useState('')
  const [estimatedEndDate, setEstimatedEndDate] = useState('')
  const [currentStageId, setCurrentStageId] = useState('')
  const [status, setStatus] = useState('planning')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [removeCover, setRemoveCover] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    void listActiveSaleTypes()
      .then(setSaleTypes)
      .catch(() => setSaleTypes([]))
    void listActiveStages()
      .then(setStages)
      .catch(() => setStages([]))
  }, [open])

  useEffect(() => {
    if (!open) return
    if (obra) {
      setName(obra.name)
      setCode(obra.code || '')
      setSaleTypeId(String(obra.saleTypeId))
      setAddress(obra.address || '')
      setCity(obra.city || '')
      setNeighborhood(obra.neighborhood || '')
      setStartDate(obra.startDate || '')
      setEstimatedEndDate(obra.estimatedEndDate || '')
      setCurrentStageId(obra.currentStageId ? String(obra.currentStageId) : '')
      setStatus(obra.status || 'planning')
      setCoverPreview(obra.coverImageUrl || null)
    } else {
      setName('')
      setCode('')
      setSaleTypeId('')
      setAddress('')
      setCity('')
      setNeighborhood('')
      setStartDate('')
      setEstimatedEndDate('')
      setCurrentStageId('')
      setStatus('planning')
      setCoverPreview(null)
    }
    setCoverFile(null)
    setRemoveCover(false)
    setFormError(null)
  }, [open, obra])

  useEffect(() => {
    if (!coverFile) return
    const url = URL.createObjectURL(coverFile)
    setCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverFile])

  function onPickCover(file: File | null) {
    if (!file) {
      setCoverFile(null)
      return
    }
    const error = validateObraCoverFile(file)
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setRemoveCover(false)
    setCoverFile(file)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!saleTypeId) {
      setFormError('Selecciona un tipo de venta.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      let saved: Obra
      if (obra) {
        saved = await updateObra(obra.id, {
          name: name.trim(),
          code: code.trim() || null,
          saleTypeId: Number(saleTypeId),
          address: address.trim() || null,
          city: city.trim() || null,
          neighborhood: neighborhood.trim() || null,
          startDate: startDate || null,
          estimatedEndDate: estimatedEndDate || null,
          status,
        })
      } else {
        saved = await createObra({
          name: name.trim(),
          code: code.trim() || null,
          saleTypeId: Number(saleTypeId),
          address: address.trim() || null,
          city: city.trim() || null,
          neighborhood: neighborhood.trim() || null,
          startDate: startDate || null,
          estimatedEndDate: estimatedEndDate || null,
          currentStageId: currentStageId ? Number(currentStageId) : null,
          status,
        })
      }

      if (coverFile) {
        saved = await uploadObraCover(saved.id, coverFile)
      } else if (editing && removeCover && obra?.coverImageUrl) {
        saved = await deleteObraCover(saved.id)
      }

      toast.success(editing ? 'Obra actualizada' : 'Obra creada')
      onSaved(saved)
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(err.message || 'El código de obra ya existe.')
      } else {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  const previewSrc =
    coverPreview ||
    (obra && !removeCover ? resolveObraCover(obra) : null)

  return (
    <Modal
      title={editing ? 'Editar obra' : 'Nueva obra'}
      open={open}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="obra-form" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="obra-form" className={styles.formGrid} onSubmit={handleSubmit}>
        {saleTypes.length === 0 ? (
          <Alert tone="info">
            No hay tipos de venta activos. Créalos en Configuración Global antes de
            guardar.
          </Alert>
        ) : null}

        <Field
          label="Imagen principal"
          hint="JPEG, PNG o WebP · máx. 15 MB. Se comprime en el servidor."
        >
          <div className={styles.coverPicker}>
            {previewSrc ? (
              <img
                className={styles.coverPreview}
                src={previewSrc}
                alt=""
                width={320}
                height={180}
              />
            ) : (
              <div className={styles.coverPlaceholder}>Sin imagen</div>
            )}
            <div className={styles.coverActions}>
              <label className={styles.fileLabel}>
                <input
                  type="file"
                  accept={OBRA_COVER_ACCEPT}
                  disabled={saving}
                  onChange={(e) => onPickCover(e.target.files?.[0] ?? null)}
                />
                {coverFile || previewSrc ? 'Cambiar imagen' : 'Subir imagen'}
              </label>
              {editing && (obra?.coverImageUrl || coverFile) && !removeCover ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    setCoverFile(null)
                    setCoverPreview(null)
                    setRemoveCover(true)
                  }}
                >
                  Quitar
                </Button>
              ) : null}
              {removeCover ? (
                <span className={styles.coverHint}>Se quitará al guardar</span>
              ) : null}
            </div>
          </div>
        </Field>

        <Field label="Nombre">
          <TextInput
            required
            disabled={saving}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Residencial Los Pinos"
          />
        </Field>
        <div className={styles.formRow}>
          <Field label="Código" hint="Único si se envía">
            <TextInput
              disabled={saving}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="OBR-001"
            />
          </Field>
          <Field label="Tipo de venta">
            <TextSelect
              required
              disabled={saving}
              value={saleTypeId}
              onChange={(e) => setSaleTypeId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {saleTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </TextSelect>
          </Field>
        </div>
        <Field label="Dirección">
          <TextInput
            disabled={saving}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>
        <div className={styles.formRow}>
          <Field label="Ciudad">
            <TextInput
              disabled={saving}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </Field>
          <Field label="Barrio">
            <TextInput
              disabled={saving}
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
            />
          </Field>
        </div>
        <div className={styles.formRow}>
          <Field label="Inicio">
            <TextInput
              type="date"
              disabled={saving}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Fin estimado">
            <TextInput
              type="date"
              disabled={saving}
              value={estimatedEndDate}
              onChange={(e) => setEstimatedEndDate(e.target.value)}
            />
          </Field>
        </div>
        <div className={styles.formRow}>
          <Field label="Status">
            <TextSelect
              disabled={saving}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {OBRA_STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </TextSelect>
          </Field>
          {!editing ? (
            <Field label="Etapa inicial" hint="Opcional">
              <TextSelect
                disabled={saving}
                value={currentStageId}
                onChange={(e) => setCurrentStageId(e.target.value)}
              >
                <option value="">Sin etapa</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </TextSelect>
            </Field>
          ) : (
            <Field label="Etapa actual" hint="Cámbiala en el detalle de la obra">
              <TextInput
                disabled
                value={obra?.currentStageName || 'Sin etapa'}
              />
            </Field>
          )}
        </div>
        {formError ? <Alert tone="error">{formError}</Alert> : null}
      </form>
    </Modal>
  )
}
