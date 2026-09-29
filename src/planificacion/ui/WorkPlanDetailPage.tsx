import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/auth'
import { listUsers } from '@/identidad/api/usersApi'
import type { AppUser } from '@/identidad/model/types'
import {
  addWorkPlanSigner,
  addWorkPlanTask,
  cancelWorkPlanSignature,
  createWorkPlanVersion,
  getWorkPlan,
  registerWorkPlanView,
  rejectWorkPlan,
  removeWorkPlanSigner,
  removeWorkPlanSnapshot,
  requestWorkPlanSignature,
  signWorkPlan,
  updateWorkPlan,
} from '@/planificacion/api/planesApi'
import {
  canCreateNewVersion,
  canRequestSignature,
  formatDateTime,
  formatPlanDate,
  isPlanEditable,
  planStatusTone,
  signerStatusTone,
} from '@/planificacion/lib/planUi'
import type { WorkPlanDetail } from '@/planificacion/model/types'
import {
  EVENT_TYPE_LABELS,
  SIGNER_STATUS_LABELS,
  WORK_PLAN_STATUS_LABELS,
} from '@/planificacion/model/types'
import { listTasks } from '@/tareas/api/tareasApi'
import type { Task } from '@/tareas/model/types'
import { ApiError } from '@/shared/api/apiJson'
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
import { SignaturePad } from './SignaturePad'
import padStyles from './SignaturePad.module.css'
import styles from './planificacion.module.css'

export function WorkPlanDetailPage() {
  const { planId: planIdParam } = useParams()
  const planId = Number(planIdParam)
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const userId = Number(user?.id)

  const [detail, setDetail] = useState<WorkPlanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')

  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [taskToAdd, setTaskToAdd] = useState('')

  const [users, setUsers] = useState<AppUser[]>([])
  const [signerUserId, setSignerUserId] = useState('')
  const [signerOrder, setSignerOrder] = useState('')

  const [signOpen, setSignOpen] = useState(false)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [signError, setSignError] = useState<string | null>(null)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  useDocumentTitle(
    detail ? `Quasar · ${detail.workPlan.name}` : 'Quasar · Plan',
  )

  const load = useCallback(async () => {
    if (!Number.isFinite(planId)) {
      setError('Plan inválido')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getWorkPlan(planId)
      setDetail(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el plan')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!detail || detail.workPlan.status !== 'pending_signature') return
    void registerWorkPlanView(planId).catch(() => undefined)
  }, [detail, planId])

  useEffect(() => {
    void listUsers({ page: 1, statusId: 1 })
      .then((data) => setUsers(data.users))
      .catch(() => setUsers([]))
  }, [])

  const plan = detail?.workPlan
  const current = detail?.currentVersion
  const version = current?.version
  const editable = plan
    ? isPlanEditable(plan.status, version?.isImmutable)
    : false

  const mySigner = useMemo(() => {
    if (!current || !Number.isFinite(userId)) return null
    return current.signers.find((s) => s.userId === userId) || null
  }, [current, userId])

  const canSign =
    plan?.status === 'pending_signature' && mySigner?.status === 'pending'

  async function runAction(label: string, action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      toast.success(label)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo completar')
    } finally {
      setBusy(false)
    }
  }

  async function openAddTask() {
    if (!plan) return
    setAddTaskOpen(true)
    setTaskToAdd('')
    try {
      const data = await listTasks({ obraId: plan.obraId, page: 1, parentOnly: true })
      const existing = new Set(current?.tasks.map((t) => t.taskId) || [])
      setAvailableTasks(
        data.tasks.filter(
          (t) =>
            !existing.has(t.id) &&
            Boolean(t.plannedStartDate && t.plannedEndDate),
        ),
      )
    } catch {
      setAvailableTasks([])
    }
  }

  async function handleSaveHeader(event: FormEvent) {
    event.preventDefault()
    await runAction('Cabecera actualizada', () =>
      updateWorkPlan(planId, {
        name: editName.trim(),
        startDate: editStart,
        endDate: editEnd,
      }),
    )
    setEditOpen(false)
  }

  async function handleAddTask(event: FormEvent) {
    event.preventDefault()
    if (!version || !taskToAdd) return
    await runAction('Actividad agregada al snapshot', () =>
      addWorkPlanTask(version.id, { taskId: Number(taskToAdd) }),
    )
    setAddTaskOpen(false)
  }

  async function handleAddSigner(event: FormEvent) {
    event.preventDefault()
    if (!version || !signerUserId) return
    await runAction('Firmante agregado', () =>
      addWorkPlanSigner(version.id, {
        userId: Number(signerUserId),
        signatureOrder: signerOrder ? Number(signerOrder) : null,
      }),
    )
    setSignerUserId('')
    setSignerOrder('')
  }

  async function handleSign(event: FormEvent) {
    event.preventDefault()
    if (!signatureData) {
      setSignError('Dibuja tu firma en el recuadro para continuar.')
      return
    }
    setBusy(true)
    setSignError(null)
    try {
      const result = await signWorkPlan(planId, {
        signatureType: 'electronic',
        signatureData,
      })
      toast.success(
        result.fullySigned
          ? 'Plan firmado por completo'
          : 'Firma registrada',
      )
      setSignOpen(false)
      setSignatureData(null)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo firmar')
    } finally {
      setBusy(false)
    }
  }

  async function handleReject(event: FormEvent) {
    event.preventDefault()
    if (!rejectReason.trim()) return
    await runAction('Plan rechazado', () =>
      rejectWorkPlan(planId, { reason: rejectReason.trim() }),
    )
    setRejectOpen(false)
    setRejectReason('')
  }

  if (loading) {
    return <p className={styles.empty}>Cargando plan…</p>
  }

  if (error || !plan) {
    return (
      <div className={styles.page}>
        <Alert tone="error">{error || 'Plan no encontrado'}</Alert>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Volver
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate(`/dashboard/obras/${plan.obraId}/planes`)}
          >
            ← Planes de la obra
          </button>
          <h1 className={styles.title}>{plan.name}</h1>
          <div className={styles.metaRow}>
            <Badge tone={planStatusTone(plan.status)}>
              {WORK_PLAN_STATUS_LABELS[plan.status]}
            </Badge>
            <span className={styles.subtitle}>
              {formatPlanDate(plan.startDate)} → {formatPlanDate(plan.endDate)}
              {version ? ` · Versión ${version.versionNumber}` : ''}
              {plan.obraName ? ` · ${plan.obraName}` : ''}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          {editable ? (
            <Button
              variant="ghost"
              onClick={() => {
                setEditName(plan.name)
                setEditStart(plan.startDate)
                setEditEnd(plan.endDate)
                setEditOpen(true)
              }}
            >
              Editar cabecera
            </Button>
          ) : null}
          {canRequestSignature(
            plan.status,
            current?.tasks.length || 0,
            current?.signers.length || 0,
          ) ? (
            <Button
              disabled={busy}
              onClick={() =>
                void runAction('Firma solicitada', () =>
                  requestWorkPlanSignature(planId),
                )
              }
            >
              Solicitar firma
            </Button>
          ) : null}
          {plan.status === 'pending_signature' ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void runAction('Solicitud cancelada', () =>
                  cancelWorkPlanSignature(planId),
                )
              }
            >
              Cancelar solicitud
            </Button>
          ) : null}
          {canSign ? (
            <>
              <Button onClick={() => {
                setSignatureData(null)
                setSignError(null)
                setSignOpen(true)
              }}>Firmar</Button>
              <Button variant="danger" onClick={() => setRejectOpen(true)}>
                Rechazar
              </Button>
            </>
          ) : null}
          {canCreateNewVersion(plan.status) ? (
            <Button
              disabled={busy}
              onClick={() =>
                void runAction('Nueva versión creada', () =>
                  createWorkPlanVersion(planId, {}),
                )
              }
            >
              Nueva versión
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => navigate(`/dashboard/planes/${planId}/comparar`)}
          >
            Comparar
          </Button>
        </div>
      </header>

      {version?.isImmutable || plan.status === 'signed' ? (
        <div className={styles.noteBox}>
          Esta versión está firmada o es inmutable. Para cambios, crea una{' '}
          <strong>nueva versión</strong>.
        </div>
      ) : null}

      {plan.status === 'rejected' ? (
        <div className={styles.warnBox}>
          El plan fue rechazado. Puedes crear una nueva versión para iterar.
        </div>
      ) : null}

      <div className={styles.grid2}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>
              Actividades del snapshot ({current?.tasks.length || 0})
            </h2>
            {editable ? (
              <Button variant="ghost" onClick={() => void openAddTask()}>
                + Actividad
              </Button>
            ) : null}
          </div>
          {!current || current.tasks.length === 0 ? (
            <p className={styles.muted}>Sin actividades en esta versión.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Actividad</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Cant.</th>
                    <th>Duración</th>
                    {editable ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {current.tasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.taskNameSnapshot}</td>
                      <td>{formatPlanDate(task.plannedStartDate)}</td>
                      <td>{formatPlanDate(task.plannedEndDate)}</td>
                      <td>
                        {task.quantitySnapshot ?? '—'}
                        {task.unitSnapshot ? ` ${task.unitSnapshot}` : ''}
                      </td>
                      <td>
                        {task.approvedDurationDaysSnapshot ??
                          task.estimatedDurationDaysSnapshot ??
                          '—'}{' '}
                        d
                      </td>
                      {editable ? (
                        <td>
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              void runAction('Actividad quitada', () =>
                                removeWorkPlanSnapshot(task.id),
                              )
                            }
                          >
                            Quitar
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>
              Firmantes ({current?.signers.length || 0})
            </h2>
          </div>
          {editable ? (
            <form className={styles.inlineForm} onSubmit={handleAddSigner}>
              <Field label="Usuario">
                <TextSelect
                  value={signerUserId}
                  onChange={(e) => setSignerUserId(e.target.value)}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {users
                    .filter(
                      (u) =>
                        !(current?.signers.some((s) => s.userId === u.id) ?? false),
                    )
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.personName || u.username}
                      </option>
                    ))}
                </TextSelect>
              </Field>
              <Field label="Orden">
                <TextInput
                  type="number"
                  value={signerOrder}
                  onChange={(e) => setSignerOrder(e.target.value)}
                  placeholder="1"
                />
              </Field>
              <Button type="submit" disabled={busy || !signerUserId}>
                Agregar
              </Button>
            </form>
          ) : null}
          {!current || current.signers.length === 0 ? (
            <p className={styles.muted}>Sin firmantes.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th>Firma</th>
                    {editable ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {[...current.signers]
                    .sort(
                      (a, b) => (a.signatureOrder || 0) - (b.signatureOrder || 0),
                    )
                    .map((signer) => (
                      <tr key={signer.id}>
                        <td>{signer.signatureOrder ?? '—'}</td>
                        <td>{signer.userName || `Usuario #${signer.userId}`}</td>
                        <td>
                          <Badge tone={signerStatusTone(signer.status)}>
                            {SIGNER_STATUS_LABELS[signer.status]}
                          </Badge>
                          {signer.rejectionReason ? (
                            <p className={styles.muted}>{signer.rejectionReason}</p>
                          ) : null}
                        </td>
                        <td>
                          {signer.signatureData?.startsWith('data:image/') ? (
                            <img
                              src={signer.signatureData}
                              alt={`Firma de ${signer.userName || signer.userId}`}
                              className={padStyles.preview}
                            />
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                        {editable ? (
                          <td>
                            <Button
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                void runAction('Firmante quitado', () =>
                                  removeWorkPlanSigner(signer.id),
                                )
                              }
                            >
                              Quitar
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Historial de eventos</h2>
          {detail.versions.length > 1 ? (
            <div className={styles.chipList}>
              {detail.versions.map((v) => (
                <span
                  key={v.id}
                  className={`${styles.versionChip} ${
                    v.id === version?.id ? styles.versionChipActive : ''
                  }`}
                >
                  v{v.versionNumber}
                  {v.isImmutable ? ' · inmutable' : ''}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {!current || current.events.length === 0 ? (
          <p className={styles.muted}>Sin eventos todavía.</p>
        ) : (
          <ul className={styles.timeline}>
            {[...current.events]
              .sort((a, b) =>
                String(b.eventAt || '').localeCompare(String(a.eventAt || '')),
              )
              .map((event) => (
                <li key={event.id} className={styles.timelineItem}>
                  <p className={styles.timelineTitle}>
                    {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                  </p>
                  <p className={styles.timelineMeta}>
                    {formatDateTime(event.eventAt)}
                    {event.userName ? ` · ${event.userName}` : ''}
                    {event.details ? ` · ${event.details}` : ''}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      <Modal
        title="Editar cabecera"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="edit-plan-header" disabled={busy}>
              Guardar
            </Button>
          </>
        }
      >
        <form id="edit-plan-header" className={styles.formGrid} onSubmit={handleSaveHeader}>
          <Field label="Nombre">
            <TextInput
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
          </Field>
          <div className={styles.twoCol}>
            <Field label="Inicio">
              <TextInput
                type="date"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                required
              />
            </Field>
            <Field label="Fin">
              <TextInput
                type="date"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                required
              />
            </Field>
          </div>
        </form>
      </Modal>

      <Modal
        title="Agregar actividad al snapshot"
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddTaskOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="add-plan-task" disabled={busy || !taskToAdd}>
              Agregar
            </Button>
          </>
        }
      >
        <form id="add-plan-task" className={styles.formGrid} onSubmit={handleAddTask}>
          <Field label="Actividad">
            <TextSelect
              value={taskToAdd}
              onChange={(e) => setTaskToAdd(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {availableTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          {availableTasks.length === 0 ? (
            <p className={styles.muted}>
              No hay más actividades elegibles (con fechas) fuera del snapshot.
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        title="Firmar plan"
        open={signOpen}
        onClose={() => {
          setSignOpen(false)
          setSignatureData(null)
          setSignError(null)
        }}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setSignOpen(false)
                setSignatureData(null)
                setSignError(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="sign-plan"
              disabled={busy || !signatureData}
            >
              Confirmar firma
            </Button>
          </>
        }
      >
        <form id="sign-plan" className={styles.formGrid} onSubmit={handleSign}>
          <div className={styles.noteBox}>
            Dibuja tu firma con el mouse o el dedo. Se guarda como imagen
            base64 en el plan.
          </div>
          {signError ? <Alert tone="error">{signError}</Alert> : null}
          <Field label="Firma manuscrita" help="Obligatoria para confirmar.">
            {signOpen ? (
              <SignaturePad
                disabled={busy}
                onChange={(value) => {
                  setSignatureData(value)
                  if (value) setSignError(null)
                }}
              />
            ) : null}
          </Field>
        </form>
      </Modal>

      <Modal
        title="Rechazar plan"
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="reject-plan"
              variant="danger"
              disabled={busy || !rejectReason.trim()}
            >
              Rechazar
            </Button>
          </>
        }
      >
        <form id="reject-plan" className={styles.formGrid} onSubmit={handleReject}>
          <Field label="Motivo" help="Obligatorio.">
            <TextArea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
