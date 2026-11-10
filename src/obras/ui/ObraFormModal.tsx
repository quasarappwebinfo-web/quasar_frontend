import { useEffect, useState, type FormEvent } from 'react'
import { isSuperUser, useAuth } from '@/auth'
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
import type { Obra, ObraChapterOpening, SaleTypeOption, StageOption } from '@/obras/model/types'
import { listActiveTaskChapters } from '@/task-pool/api/capitulosApi'
import { listTaskTemplates } from '@/task-pool/api/plantillasApi'
import type { TaskChapter, TaskTemplate } from '@/task-pool/model/types'
import { ApiError } from '@/shared/api/apiJson'
import {
  Alert,
  Button,
  Field,
  Modal,
  TextInput,
  TextSelect,
  UploadOverlay,
  useToast,
} from '@/shared/ui'
import styles from './DashboardPage.module.css'

type ObraFormModalProps = {
  open: boolean
  obra: Obra | null
  onClose: () => void
  onSaved: (obra: Obra) => void
}

type OpeningMode = 'program' | 'completed' | 'partial'

type ChapterChoice = {
  mode: OpeningMode
  percent: string
  templateIds: number[]
}

const PROGRAMMED: ChapterChoice = { mode: 'program', percent: '', templateIds: [] }

export function ObraFormModal({ open, obra, onClose, onSaved }: ObraFormModalProps) {
  const toast = useToast()
  const { user } = useAuth()
  const editing = Boolean(obra)
  const canOpenChapters = !editing && isSuperUser(user)
  const [saleTypes, setSaleTypes] = useState<SaleTypeOption[]>([])
  const [stages, setStages] = useState<StageOption[]>([])
  const [name, setName] = useState('')
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
  const [uploadingCover, setUploadingCover] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [chapters, setChapters] = useState<TaskChapter[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [openings, setOpenings] = useState<Record<number, ChapterChoice>>({})
  const [catalogState, setCatalogState] = useState<'idle' | 'ready'>('idle')

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
    setOpenings({})
  }, [open, obra])

  useEffect(() => {
    if (!open || !canOpenChapters) return
    let cancelled = false
    setCatalogState('idle')
    void Promise.all([listActiveTaskChapters(), listEveryTemplates()])
      .then(([chapterRows, templateRows]) => {
        if (cancelled) return
        setChapters(chapterRows)
        setTemplates(templateRows)
        setOpenings(
          Object.fromEntries(chapterRows.map((chapter) => [chapter.id, { ...PROGRAMMED }])),
        )
      })
      .catch(() => {
        if (cancelled) return
        setChapters([])
        setTemplates([])
      })
      .finally(() => {
        if (!cancelled) setCatalogState('ready')
      })
    return () => {
      cancelled = true
    }
  }, [open, canOpenChapters])

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
    const chapterOpenings = canOpenChapters ? collectOpenings(chapters, openings) : null
    if (chapterOpenings && typeof chapterOpenings === 'string') {
      setFormError(chapterOpenings)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      let saved: Obra
      if (obra) {
        saved = await updateObra(obra.id, {
          name: name.trim(),
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
          saleTypeId: Number(saleTypeId),
          address: address.trim() || null,
          city: city.trim() || null,
          neighborhood: neighborhood.trim() || null,
          startDate: startDate || null,
          estimatedEndDate: estimatedEndDate || null,
          currentStageId: currentStageId ? Number(currentStageId) : null,
          status,
          ...(Array.isArray(chapterOpenings) && chapterOpenings.length > 0
            ? { chapterOpenings }
            : {}),
        })
      }

      if (coverFile) {
        setUploadingCover(true)
        try {
          saved = await uploadObraCover(saved.id, coverFile)
        } finally {
          setUploadingCover(false)
        }
      } else if (editing && removeCover && obra?.coverImageUrl) {
        saved = await deleteObraCover(saved.id)
      }

      toast.success(editing ? 'Obra actualizada' : 'Obra creada')
      onSaved(saved)
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(err.message || 'No se pudo guardar la obra.')
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
    <>
    <UploadOverlay open={uploadingCover} />
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
            No hay tipos de venta activos.
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
            <Field
              label="Etapa actual"
              hint="Se elige al crear la obra. El avance de la obra sale de los capítulos."
            >
              <TextInput
                disabled
                value={obra?.currentStageName || 'Sin etapa'}
              />
            </Field>
          )}
        </div>
        {canOpenChapters ? (
          <section className={styles.opening}>
            <div>
              <h3 className={styles.openingTitle}>Obra ya comenzada</h3>
              <p className={styles.openingLead}>
                Marca los capítulos que ya llegaron hechos. En uno a medias eliges
                las actividades del pool. Los demás se programan solos.
              </p>
            </div>
            {catalogState !== 'ready' ? (
              <p className={styles.openingLead}>Cargando capítulos…</p>
            ) : chapters.length === 0 ? (
              <p className={styles.openingLead}>No hay capítulos activos en el pool.</p>
            ) : (
              chapters.map((chapter) => {
                const choice = openings[chapter.id] ?? PROGRAMMED
                const pool = templates.filter((item) => item.chapterId === chapter.id)
                return (
                  <article key={chapter.id} className={styles.openingChapter}>
                    <div className={styles.openingHead}>
                      <strong>{chapter.name}</strong>
                      <TextSelect
                        aria-label={`Avance de ${chapter.name}`}
                        disabled={saving}
                        value={choice.mode}
                        onChange={(event) =>
                          setOpenings((current) => ({
                            ...current,
                            [chapter.id]: {
                              ...choice,
                              mode: event.target.value as OpeningMode,
                            },
                          }))
                        }
                      >
                        <option value="program">Programar</option>
                        <option value="completed">Completado</option>
                        <option value="partial">A medias</option>
                      </TextSelect>
                    </div>
                    {choice.mode === 'completed' ? (
                      <p className={styles.openingLead}>
                        Queda en 100%. Sus actividades fijas se crean como hechas.
                      </p>
                    ) : null}
                    {choice.mode === 'partial' ? (
                      <>
                        <Field label="Avance con el que llega">
                          <TextInput
                            type="number"
                            min={1}
                            max={99}
                            disabled={saving}
                            value={choice.percent}
                            placeholder="70"
                            onChange={(event) =>
                              setOpenings((current) => ({
                                ...current,
                                [chapter.id]: { ...choice, percent: event.target.value },
                              }))
                            }
                          />
                        </Field>
                        <div className={styles.openingActivities}>
                          {pool.length === 0 ? (
                            <p className={styles.openingLead}>
                              Este capítulo no tiene actividades en el pool.
                            </p>
                          ) : (
                            pool.map((template) => {
                              const checked = choice.templateIds.includes(template.id)
                              return (
                                <label key={template.id} className={styles.openingCheck}>
                                  <input
                                    type="checkbox"
                                    disabled={saving}
                                    checked={checked}
                                    onChange={() =>
                                      setOpenings((current) => {
                                        const previous = current[chapter.id] ?? PROGRAMMED
                                        const templateIds = checked
                                          ? previous.templateIds.filter((id) => id !== template.id)
                                          : [...previous.templateIds, template.id]
                                        return {
                                          ...current,
                                          [chapter.id]: { ...previous, templateIds },
                                        }
                                      })
                                    }
                                  />
                                  <span>{template.name}</span>
                                </label>
                              )
                            })
                          )}
                        </div>
                      </>
                    ) : null}
                  </article>
                )
              })
            )}
          </section>
        ) : null}
        {formError ? <Alert tone="error">{formError}</Alert> : null}
      </form>
    </Modal>
    </>
  )
}

async function listEveryTemplates(): Promise<TaskTemplate[]> {
  const all: TaskTemplate[] = []
  let page = 1
  let total = 0
  do {
    const data = await listTaskTemplates({ page, activeOnly: true })
    all.push(...data.templates)
    total = data.pagination.totalItems
    page += 1
  } while (all.length < total && page <= 40)
  return all
}

function collectOpenings(
  chapters: TaskChapter[],
  openings: Record<number, ChapterChoice>,
): ObraChapterOpening[] | string {
  const payload: ObraChapterOpening[] = []
  for (const chapter of chapters) {
    const choice = openings[chapter.id]
    if (!choice || choice.mode === 'program') continue
    if (choice.mode === 'completed') {
      payload.push({ chapterId: chapter.id, mode: 'completed', templateIds: [] })
      continue
    }
    const percent = Number(choice.percent)
    if (!Number.isInteger(percent) || percent < 1 || percent > 99) {
      return `${chapter.name}: indica un avance entre 1 y 99.`
    }
    if (choice.templateIds.length === 0) {
      return `${chapter.name}: elige las actividades del pool que vas a usar.`
    }
    payload.push({
      chapterId: chapter.id,
      mode: 'partial',
      progressPercent: percent,
      templateIds: choice.templateIds,
    })
  }
  return payload
}
