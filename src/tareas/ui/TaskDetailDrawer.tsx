import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  createTask,
  getTaskDetail,
  markTaskDelayed,
  toggleSubtask,
  updateTask,
  uploadTaskDocument,
} from '@/tareas/api/tareasApi'
import { categoryColor, formatTaskDate } from '@/tareas/lib/taskUi'
import type { Task, TaskDetail } from '@/tareas/model/types'
import { TASK_STATUS_BADGE } from '@/tareas/model/types'
import { ApiError } from '@/shared/api/apiJson'
import {
  syncAddComment,
  syncAddPhoto,
  syncChangeTaskStatus,
  syncMarkDelayed,
  useSync,
} from '@/sync'
import {
  Alert,
  Button,
  Field,
  Modal,
  TextArea,
  TextInput,
  useToast,
} from '@/shared/ui'
import styles from './tareas.module.css'

type TaskDetailDrawerProps = {
  taskId: number | null
  open: boolean
  onClose: () => void
  onChanged: () => void
}

const ACTIVITY_LABELS: Record<string, string> = {
  created: 'Creación',
  updated: 'Edición',
  status_change: 'Cambio de estado',
  note: 'Nota',
  instruction: 'Instrucción',
  photo: 'Foto',
  document: 'Documento',
  delay: 'Retraso',
  reschedule: 'Reprogramación',
}

function formatRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '—'
  if (start && end && start !== end) {
    return `${formatTaskDate(start)} – ${formatTaskDate(end)}`
  }
  return formatTaskDate(start || end)
}

function formatWhen(value?: string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function TaskDetailDrawer({
  taskId,
  open,
  onClose,
  onChanged,
}: TaskDetailDrawerProps) {
  const toast = useToast()
  const { refreshSnapshot, runSync } = useSync()
  const fileRef = useRef<HTMLInputElement>(null)
  const docFileRef = useRef<HTMLInputElement>(null)
  const evidenceFileRef = useRef<HTMLInputElement>(null)
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedEnd, setPlannedEnd] = useState('')

  const [delayed, setDelayed] = useState(false)
  const [delayReason, setDelayReason] = useState('')
  const [note, setNote] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [newSubtaskWeight, setNewSubtaskWeight] = useState('')
  const [showAddSubtask, setShowAddSubtask] = useState(false)

  const [pendingSubtask, setPendingSubtask] = useState<Task | null>(null)
  const [evidenceNote, setEvidenceNote] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([])
  const [evidenceSaving, setEvidenceSaving] = useState(false)
  const [evidenceError, setEvidenceError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!taskId || !open) return
    setLoading(true)
    setError(null)
    try {
      const data = await getTaskDetail(taskId)
      setDetail(data)
      setName(data.task.name)
      setDescription(data.task.description || '')
      setPlannedStart(data.task.plannedStartDate || '')
      setPlannedEnd(data.task.plannedEndDate || '')
      setDelayed(Boolean(data.task.isDelayed))
      const openDelay = data.delays.find((d) => !d.endDate)
      setDelayReason(openDelay?.description || '')
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la actividad')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [taskId, open])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => {
      evidencePreviews.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [evidencePreviews])

  function resetEvidenceModal() {
    evidencePreviews.forEach((url) => URL.revokeObjectURL(url))
    setPendingSubtask(null)
    setEvidenceNote('')
    setEvidenceFiles([])
    setEvidencePreviews([])
    setEvidenceError(null)
    setEvidenceSaving(false)
  }

  if (!open) return null

  const task = detail?.task

  async function handleSave() {
    if (!task) return
    setSaving(true)
    setError(null)
    try {
      await updateTask(task.id, {
        name: name.trim(),
        description: description.trim() || null,
        plannedStartDate: plannedStart || null,
        plannedEndDate: plannedEnd || null,
      })
      if (
        task.status !== 'scheduled' &&
        task.status !== 'rescheduled' &&
        (delayed !== Boolean(task.isDelayed) || (delayed && delayReason.trim()))
      ) {
        const delayRes = await syncMarkDelayed({
          taskId: task.id,
          taskUuid: task.uuid,
          delayed,
          description: delayReason.trim().slice(0, 250) || null,
        })
        if (delayRes.offline) {
          toast.success('Retraso guardado offline; se sincronizará al volver la red')
          await refreshSnapshot()
        }
      }
      toast.success('Cambios guardados')
      setEditing(false)
      await load()
      onChanged()
      void runSync()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleDelay(next: boolean) {
    setDelayed(next)
    if (!task) return
    if (!next) {
      try {
        await markTaskDelayed(task.id, { delayed: false })
        toast.success('Retraso cerrado')
        await load()
        onChanged()
      } catch (err) {
        setDelayed(true)
        toast.error(err instanceof Error ? err.message : 'No se pudo actualizar')
      }
      return
    }
    // Abrir retraso: se confirma al guardar o con motivo vacío vía sync
  }

  function requestSubtaskToggle(sub: Task, completed: boolean) {
    if (!task) return
    if (task.status === 'scheduled' || task.status === 'rescheduled') {
      toast.error(
        'Esta actividad aún no está en ejecución. Solo puedes preparar subactividades y documentos.',
      )
      return
    }
    if (!completed) {
      void handleUncompleteSubtask(sub.id)
      return
    }
    setPendingSubtask(sub)
    setEvidenceNote('')
    setEvidenceFiles([])
    setEvidencePreviews([])
    setEvidenceError(null)
  }

  async function handleUncompleteSubtask(subId: number) {
    if (!task) return
    try {
      await toggleSubtask(task.id, subId, false)
      toast.success('Subactividad reabierta')
      await load()
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar')
    }
  }

  function addEvidenceFiles(files: FileList | null) {
    if (!files?.length) return
    const next = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (next.length === 0) {
      setEvidenceError('Solo se admiten imágenes (JPEG, PNG o WebP).')
      return
    }
    setEvidenceError(null)
    setEvidenceFiles((prev) => [...prev, ...next])
    setEvidencePreviews((prev) => [
      ...prev,
      ...next.map((f) => URL.createObjectURL(f)),
    ])
  }

  function removeEvidenceFile(index: number) {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index))
    setEvidencePreviews((prev) => {
      const url = prev[index]
      if (url) URL.revokeObjectURL(url)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleConfirmSubtaskEvidence() {
    if (!task || !pendingSubtask) return
    const noteText = evidenceNote.trim()
    if (!noteText) {
      setEvidenceError('Describe qué se hizo en esta subactividad.')
      return
    }
    if (evidenceFiles.length === 0) {
      setEvidenceError('Agrega al menos una foto de evidencia.')
      return
    }

    setEvidenceSaving(true)
    setEvidenceError(null)
    try {
      for (const file of evidenceFiles) {
        const photoRes = await syncAddPhoto({
          taskId: task.id,
          taskUuid: task.uuid,
          file,
          description: `Evidencia subactividad «${pendingSubtask.name}»: ${noteText.slice(0, 120)}`,
        })
        if (photoRes.offline) await refreshSnapshot()
      }
      const noteRes = await syncAddComment({
        taskId: task.id,
        taskUuid: task.uuid,
        content: `[Subactividad completada: ${pendingSubtask.name}]\n${noteText}`,
      })
      if (noteRes.offline) await refreshSnapshot()

      try {
        await toggleSubtask(task.id, pendingSubtask.id, true)
      } catch (err) {
        // Offline / red: encolar cambio de estado de la subactividad
        if (!navigator.onLine || err instanceof TypeError) {
          await syncChangeTaskStatus({
            taskId: pendingSubtask.id,
            taskUuid: pendingSubtask.uuid,
            toStatus: 'completed',
          })
          await refreshSnapshot()
        } else {
          throw err
        }
      }
      toast.success(
        noteRes.offline || !navigator.onLine
          ? 'Subactividad completada (evidencia en cola de sync)'
          : 'Subactividad completada con evidencia',
      )
      resetEvidenceModal()
      await load()
      onChanged()
      void runSync()
    } catch (err) {
      setEvidenceError(
        err instanceof Error ? err.message : 'No se pudo registrar la evidencia',
      )
    } finally {
      setEvidenceSaving(false)
    }
  }

  async function handleAddSubtask(event: FormEvent) {
    event.preventDefault()
    if (!task || !newSubtask.trim()) return
    const weight = Number(newSubtaskWeight)
    if (Number.isNaN(weight) || weight <= 0 || weight > 100) {
      toast.error('Indica el % de la subactividad (mayor a 0 y hasta 100)')
      return
    }
    try {
      await createTask({
        obraId: task.obraId,
        parentTaskId: task.id,
        name: newSubtask.trim(),
        weightPercent: weight,
      })
      setNewSubtask('')
      setNewSubtaskWeight('')
      setShowAddSubtask(false)
      toast.success('Subactividad creada')
      await load()
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear')
    }
  }

  async function handleAddNote(event: FormEvent) {
    event.preventDefault()
    if (!task || !note.trim()) return
    try {
      const result = await syncAddComment({
        taskId: task.id,
        taskUuid: task.uuid,
        content: note.trim(),
      })
      setNote('')
      toast.success(
        result.offline
          ? 'Nota guardada offline; se subirá al sincronizar'
          : 'Nota agregada',
      )
      await refreshSnapshot()
      await load()
      void runSync()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar')
    }
  }

  async function handlePhotoSelected(file: File | null) {
    if (!task || !file) return
    if (task.status === 'scheduled' || task.status === 'rescheduled') {
      toast.error('Las evidencias fotográficas solo aplican cuando la actividad está en progreso.')
      return
    }
    try {
      const result = await syncAddPhoto({
        taskId: task.id,
        taskUuid: task.uuid,
        file,
      })
      toast.success(
        result.offline
          ? 'Foto en cola offline; se subirá al sincronizar'
          : 'Foto subida',
      )
      await refreshSnapshot()
      await load()
      onChanged()
      void runSync()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir')
    }
  }

  async function handleDocumentSelected(file: File | null) {
    if (!task || !file) return
    try {
      await uploadTaskDocument(task.id, file)
      toast.success('Documento adjunto')
      await load()
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir el documento')
    }
  }

  async function handleComplete() {
    if (!task) return
    if (task.status !== 'in_progress') {
      toast.error('Solo se puede marcar como hecha una actividad en progreso.')
      return
    }
    setSaving(true)
    try {
      const result = await syncChangeTaskStatus({
        taskId: task.id,
        taskUuid: task.uuid,
        toStatus: 'completed',
      })
      toast.success(
        result.offline
          ? 'Completada offline; se sincronizará al volver la red'
          : 'Actividad completada',
      )
      await refreshSnapshot()
      await load()
      onChanged()
      void runSync()
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
      } else {
        toast.error(err instanceof Error ? err.message : 'No se pudo completar')
      }
    } finally {
      setSaving(false)
    }
  }

  const progress = Number(task?.progressPercent || 0)
  const done = task?.subtasksDone ?? 0
  const total = task?.subtaskCount ?? detail?.subtasks.length ?? 0
  const assignee = task?.primaryAssignee
  const activity = detail?.activity || []
  const isPlanning =
    task?.status === 'scheduled' || task?.status === 'rescheduled'
  const canExecuteWork = task?.status === 'in_progress'

  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} role="presentation">
        <aside
          className={styles.drawer}
          onClick={(e) => e.stopPropagation()}
          aria-label="Detalle de actividad"
        >
          {loading && !detail ? (
            <p className={styles.drawerMuted}>Cargando…</p>
          ) : error && !detail ? (
            <Alert tone="error">{error}</Alert>
          ) : task ? (
            <>
              <header className={styles.drawerHeader}>
                <div className={styles.drawerTitleRow}>
                  {editing ? (
                    <TextInput
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  ) : (
                    <h2 className={styles.drawerTitle}>{task.name}</h2>
                  )}
                  <div className={styles.drawerHeaderActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={editing ? 'Dejar de editar' : 'Editar'}
                      onClick={() => setEditing((v) => !v)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Cerrar"
                      onClick={onClose}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <span
                  className={`${styles.statusBadge} ${
                    styles[`status_${task.status}`] || ''
                  }`}
                >
                  <span className={styles.statusDot} />
                  {TASK_STATUS_BADGE[task.status]}
                </span>
              </header>

              {error ? <Alert tone="error">{error}</Alert> : null}

              {isPlanning ? (
                <p className={styles.planningBanner}>
                  Actividad programada: puedes preparar subactividades y adjuntar
                  documentos. El retraso, las evidencias y marcar como hecha
                  solo están disponibles cuando la pases a En progreso (con
                  confirmación en el tablero).
                </p>
              ) : null}

              <div className={styles.drawerMetaGrid}>
                <div>
                  <p className={styles.metaLabel}>Fecha programada</p>
                  <p className={styles.metaValue}>
                    {editing ? (
                      <span className={styles.datePair}>
                        <TextInput
                          type="date"
                          value={plannedStart}
                          onChange={(e) => setPlannedStart(e.target.value)}
                        />
                        <TextInput
                          type="date"
                          value={plannedEnd}
                          onChange={(e) => setPlannedEnd(e.target.value)}
                        />
                      </span>
                    ) : (
                      formatRange(task.plannedStartDate, task.plannedEndDate)
                    )}
                  </p>
                </div>
                <div>
                  <p className={styles.metaLabel}>Fecha límite</p>
                  <p className={styles.metaValue}>
                    {formatTaskDate(task.plannedEndDate)}
                  </p>
                </div>
                <div>
                  <p className={styles.metaLabel}>Asignado</p>
                  <p className={styles.metaValue}>
                    {assignee?.workerName ||
                      assignee?.crewName ||
                      'Sin asignar'}
                    {assignee?.positionName
                      ? ` · ${assignee.positionName}`
                      : ''}
                  </p>
                </div>
                <div>
                  <p className={styles.metaLabel}>Categoría</p>
                  {task.categoryName ? (
                    <span
                      className={styles.categoryChip}
                      style={{
                        background: categoryColor(
                          task.categoryName,
                          task.categoryId,
                        ),
                      }}
                    >
                      {task.categoryName}
                    </span>
                  ) : (
                    <p className={styles.metaValue}>—</p>
                  )}
                </div>
                {task.budgetActivityName ? (
                  <div>
                    <p className={styles.metaLabel}>Act. presupuestal</p>
                    <p className={styles.metaValue}>{task.budgetActivityName}</p>
                  </div>
                ) : null}
                {task.zoneName ? (
                  <div>
                    <p className={styles.metaLabel}>Zona</p>
                    <p className={styles.metaValue}>{task.zoneName}</p>
                  </div>
                ) : null}
              </div>

              <section className={styles.drawerSection}>
                <h3 className={styles.sectionLabel}>Descripción</h3>
                {editing ? (
                  <TextArea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                ) : (
                  <p className={styles.drawerBody}>
                    {task.description || 'Sin descripción.'}
                  </p>
                )}
              </section>

              {!isPlanning ? (
                <section className={styles.delayBox}>
                  <div className={styles.delayToggleRow}>
                    <span>Marcar como retrasada</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={delayed}
                      className={`${styles.switch} ${delayed ? styles.switchOn : ''}`}
                      onClick={() => void handleToggleDelay(!delayed)}
                    >
                      <span className={styles.switchKnob} />
                    </button>
                  </div>
                  {delayed ? (
                    <Field
                      label="Motivo del retraso"
                      help={`${delayReason.length}/250`}
                    >
                      <TextArea
                        value={delayReason}
                        onChange={(e) =>
                          setDelayReason(e.target.value.slice(0, 250))
                        }
                        rows={2}
                        placeholder="Describe el motivo…"
                      />
                    </Field>
                  ) : null}
                </section>
              ) : null}

              <section className={styles.drawerSection}>
                <div className={styles.sectionHead}>
                  <h3 className={styles.sectionLabel}>
                    Subactividades ({done}/{total})
                  </h3>
                  {!isPlanning ? (
                    <span className={styles.progressPct}>{progress}%</span>
                  ) : null}
                </div>
                <p className={styles.evidenceHint}>
                  {isPlanning
                    ? 'En programación solo puedes agregar o revisar subactividades. Marcarlas como listas requiere que la actividad esté en progreso.'
                    : 'Al marcar una subactividad como lista se pedirán fotos y una nota de lo realizado; queda registro de quién y cuándo.'}
                </p>
                {!isPlanning ? (
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                ) : null}
                <ul className={styles.subtaskList}>
                  {(detail?.subtasks || []).map((sub) => {
                    const checked =
                      sub.status === 'completed' || sub.status === 'verified'
                    return (
                      <li key={sub.id} className={styles.subtaskItem}>
                        <label
                          className={`${styles.subtaskLabel} ${
                            isPlanning ? styles.subtaskCheckboxDisabled : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isPlanning}
                            onChange={(e) =>
                              requestSubtaskToggle(sub, e.target.checked)
                            }
                          />
                          <span
                            className={
                              checked ? styles.subtaskDone : undefined
                            }
                          >
                            {sub.name}
                            {sub.weightPercent != null
                              ? ` (${Number(sub.weightPercent)}%)`
                              : ''}
                          </span>
                        </label>
                        {checked ? (
                          <p className={styles.subtaskMeta}>
                            Completada
                            {sub.updatedByName
                              ? ` por ${sub.updatedByName}`
                              : ''}
                            {sub.updatedAt || sub.actualEndDate
                              ? ` · ${formatWhen(
                                  sub.updatedAt || sub.actualEndDate,
                                )}`
                              : ''}
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
                {showAddSubtask ? (
                  <form className={styles.inlineForm} onSubmit={handleAddSubtask}>
                    <TextInput
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder="Nombre de la subactividad"
                      required
                    />
                    <TextInput
                      type="number"
                      min={0.01}
                      max={100}
                      step={0.01}
                      value={newSubtaskWeight}
                      onChange={(e) => setNewSubtaskWeight(e.target.value)}
                      placeholder="% de la actividad"
                      required
                    />
                    <Button type="submit" size="sm">
                      Agregar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddSubtask(false)}
                    >
                      Cancelar
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setShowAddSubtask(true)}
                  >
                    + Añadir subactividad
                  </button>
                )}
              </section>

              <section className={styles.drawerSection}>
                <h3 className={styles.sectionLabel}>
                  Documentos ({detail?.documents.length || 0})
                </h3>
                <ul className={styles.docList}>
                  {(detail?.documents || []).map((doc) => (
                    <li key={doc.id} className={styles.docItem}>
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                        {doc.fileName || doc.description || `Documento #${doc.id}`}
                      </a>
                      <span className={styles.docMeta}>
                        {doc.uploadedByName || `Usuario #${doc.uploadedBy}`}
                        {doc.createdAt ? ` · ${formatWhen(doc.createdAt)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => docFileRef.current?.click()}
                >
                  + Adjuntar documento
                </button>
                <input
                  ref={docFileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.dwg,.dxf"
                  hidden
                  onChange={(e) => {
                    void handleDocumentSelected(e.target.files?.[0] || null)
                    e.target.value = ''
                  }}
                />
              </section>

              {!isPlanning ? (
                <section className={styles.drawerSection}>
                  <h3 className={styles.sectionLabel}>
                    Notas ({detail?.comments.length || 0})
                  </h3>
                  <ul className={styles.notesList}>
                    {(detail?.comments || []).map((c) => (
                      <li key={c.id} className={styles.noteItem}>
                        <p className={styles.noteMeta}>
                          {c.userName || `Usuario #${c.userId}`}
                          {c.createdAt ? ` · ${formatWhen(c.createdAt)}` : ''}
                        </p>
                        <p className={styles.noteContent}>{c.content}</p>
                      </li>
                    ))}
                  </ul>
                  <form className={styles.noteForm} onSubmit={handleAddNote}>
                    <TextInput
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Añadir una nota…"
                    />
                    <Button type="submit" size="sm" disabled={!note.trim()}>
                      Enviar
                    </Button>
                  </form>
                </section>
              ) : null}

              {!isPlanning ? (
                <section className={styles.drawerSection}>
                  <h3 className={styles.sectionLabel}>
                    Evidencia fotográfica ({detail?.photos.length || 0})
                  </h3>
                  <div className={styles.photoRow}>
                    {(detail?.photos || []).map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.photoThumb}
                        title={
                          photo.description ||
                          `Subida por ${photo.uploadedByName || photo.uploadedBy}`
                        }
                      >
                        <img
                          src={photo.fileUrl}
                          alt={photo.description || 'Evidencia'}
                        />
                      </a>
                    ))}
                    <button
                      type="button"
                      className={styles.addPhotoBtn}
                      onClick={() => fileRef.current?.click()}
                    >
                      + Añadir foto
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        void handlePhotoSelected(e.target.files?.[0] || null)
                        e.target.value = ''
                      }}
                    />
                  </div>
                </section>
              ) : null}

              <section className={styles.drawerSection}>
                <h3 className={styles.sectionLabel}>
                  Registro de actividad ({activity.length})
                </h3>
                {activity.length === 0 ? (
                  <p className={styles.drawerBody}>Sin eventos aún.</p>
                ) : (
                  <ul className={styles.activityList}>
                    {activity.map((event, index) => (
                      <li
                        key={`${event.eventType}-${event.at}-${index}`}
                        className={styles.activityItem}
                      >
                        <p className={styles.activitySummary}>
                          {ACTIVITY_LABELS[event.eventType] || event.eventType}
                          {': '}
                          {event.summary}
                        </p>
                        <p className={styles.activityMeta}>
                          {event.userName ||
                            (event.userId
                              ? `Usuario #${event.userId}`
                              : 'Sistema')}
                          {' · '}
                          {formatWhen(event.at)}
                        </p>
                        {event.detail ? (
                          <p className={styles.activityDetail}>{event.detail}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <footer className={styles.drawerFooter}>
                {canExecuteWork ? (
                  <Button disabled={saving} onClick={() => void handleComplete()}>
                    Marcar como completada
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </footer>
            </>
          ) : null}
        </aside>
      </div>

      <Modal
        title={
          pendingSubtask
            ? `Completar: ${pendingSubtask.name}`
            : 'Evidencia de subactividad'
        }
        open={Boolean(pendingSubtask)}
        onClose={() => {
          if (!evidenceSaving) resetEvidenceModal()
        }}
        wide
        footer={
          <>
            <Button
              variant="ghost"
              disabled={evidenceSaving}
              onClick={resetEvidenceModal}
            >
              Cancelar
            </Button>
            <Button
              disabled={evidenceSaving}
              onClick={() => void handleConfirmSubtaskEvidence()}
            >
              {evidenceSaving ? 'Registrando…' : 'Confirmar y completar'}
            </Button>
          </>
        }
      >
        <p className={styles.evidenceHint}>
          Para marcar la subactividad como lista debes dejar nota de lo realizado y
          al menos una foto. El sistema guarda quién lo registró y cuándo.
        </p>
        {evidenceError ? <Alert tone="error">{evidenceError}</Alert> : null}
        <Field label="¿Qué se hizo?" help="Obligatorio">
          <TextArea
            value={evidenceNote}
            onChange={(e) => setEvidenceNote(e.target.value)}
            rows={4}
            placeholder="Ej. Se verificó el armado, se ajustaron estribos y se dejó listo para vaciado…"
            disabled={evidenceSaving}
          />
        </Field>
        <Field label="Fotos de evidencia" help="Al menos una imagen">
          <div className={styles.evidencePreview}>
            {evidencePreviews.map((url, index) => (
              <button
                key={url}
                type="button"
                className={styles.photoThumb}
                title="Quitar"
                disabled={evidenceSaving}
                onClick={() => removeEvidenceFile(index)}
              >
                <img
                  src={url}
                  alt={`Evidencia ${index + 1}`}
                  className={styles.evidencePreviewThumb}
                />
              </button>
            ))}
            <button
              type="button"
              className={styles.addPhotoBtn}
              disabled={evidenceSaving}
              onClick={() => evidenceFileRef.current?.click()}
            >
              + Foto
            </button>
            <input
              ref={evidenceFileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addEvidenceFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
        </Field>
      </Modal>
    </>
  )
}
