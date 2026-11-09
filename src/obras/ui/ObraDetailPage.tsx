import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { isSuperUser, useAuth } from '@/auth'
import {
  addObraClient,
  closeObraClient,
  listObraClients,
} from '@/obras/api/clientesApi'
import {
  listObraDocuments,
  updateObraDocument,
  uploadObraDocuments,
} from '@/obras/api/documentosApi'
import { getObra, updateObra } from '@/obras/api/obrasApi'
import { coverForObra, resolveObraCover } from '@/obras/lib/obraUi'
import type { Obra, ObraClient, ObraDocument } from '@/obras/model/types'
import {
  DocumentPrepareError,
  prepareDocumentFile,
} from '@/shared/lib/prepareDocument'
import { ObraFormModal } from '@/obras/ui/ObraFormModal'
import { AsistenciaModal } from '@/obras/ui/AsistenciaModal'
import { listObraAttendance } from '@/obras/api/asistenciaApi'
import {
  formatAttendanceTime,
  todayColombiaIso,
} from '@/obras/lib/asistenciaUi'
import type { ObraDailyAttendance } from '@/obras/model/asistenciaTypes'
import {
  getObraFulfillment,
  listObraPhotoGallery,
  type GalleryPhoto,
} from '@/tareas/api/tareasApi'
import { ObraPhotoUpload } from '@/tareas/ui/ObraPhotoUpload'
import type { ObraFulfillment } from '@/tareas/model/types'
import { listWorkPlans } from '@/planificacion/api/planesApi'
import {
  formatPlanDate,
  planStatusTone,
} from '@/planificacion/lib/planUi'
import type { WorkPlan } from '@/planificacion/model/types'
import { WORK_PLAN_STATUS_LABELS } from '@/planificacion/model/types'
import { listPersons } from '@/identidad/api/personasApi'
import type { Person } from '@/identidad/model/types'
import { ApiError } from '@/shared/api/apiJson'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
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
  TextSelect,
  useToast,
} from '@/shared/ui'
import styles from './ProjectView.module.css'

type AdminTab = 'clientes' | 'documentos'

const RECENT_PHOTO_COUNT = 8

const CLIENT_ROLES = [
  { value: 'comprador', label: 'Comprador' },
  { value: 'propietario', label: 'Propietario' },
  { value: 'contacto', label: 'Contacto' },
] as const

export function ObraDetailPage() {
  const { obraId } = useParams()
  const id = Number(obraId)
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const canDeactivateObra = isSuperUser(user)
  const toast = useToast()
  const [obra, setObra] = useState<Obra | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminTab, setAdminTab] = useState<AdminTab>('clientes')
  const [asistenciaOpen, setAsistenciaOpen] = useState(false)
  const [asistenciaHoy, setAsistenciaHoy] = useState<ObraDailyAttendance[]>([])
  const [asistenciaLoading, setAsistenciaLoading] = useState(false)
  const [planesRecientes, setPlanesRecientes] = useState<WorkPlan[]>([])
  const [planesLoading, setPlanesLoading] = useState(false)
  const [recentPhotos, setRecentPhotos] = useState<GalleryPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [fulfillment, setFulfillment] = useState<ObraFulfillment | null>(null)

  useDocumentTitle(obra ? `Quasar · ${obra.name}` : 'Quasar · Obra')

  const loadAsistenciaHoy = useCallback(async () => {
    if (!Number.isFinite(id)) return
    setAsistenciaLoading(true)
    try {
      const data = await listObraAttendance({
        obraId: id,
        date: todayColombiaIso(),
        currentOnly: true,
      })
      setAsistenciaHoy(data.attendance)
    } catch {
      setAsistenciaHoy([])
    } finally {
      setAsistenciaLoading(false)
    }
  }, [id])

  const loadPlanesRecientes = useCallback(async () => {
    if (!Number.isFinite(id)) return
    setPlanesLoading(true)
    try {
      const data = await listWorkPlans({ page: 1, obraId: id })
      setPlanesRecientes(data.workPlans.slice(0, 4))
    } catch {
      setPlanesRecientes([])
    } finally {
      setPlanesLoading(false)
    }
  }, [id])

  const loadRecentPhotos = useCallback(async () => {
    if (!Number.isFinite(id)) return
    setPhotosLoading(true)
    try {
      const data = await listObraPhotoGallery({ obraId: id, page: 1 })
      setRecentPhotos(data.photos.slice(0, RECENT_PHOTO_COUNT))
    } catch {
      setRecentPhotos([])
    } finally {
      setPhotosLoading(false)
    }
  }, [id])

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setError('Obra inválida')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [obraData, fulfillmentData] = await Promise.all([
        getObra(id),
        getObraFulfillment(id).catch(() => null),
      ])
      setObra(obraData)
      setFulfillment(fulfillmentData)
      void loadAsistenciaHoy()
      void loadPlanesRecientes()
      void loadRecentPhotos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la obra')
    } finally {
      setLoading(false)
    }
  }, [
    id,
    loadAsistenciaHoy,
    loadPlanesRecientes,
    loadRecentPhotos,
  ])

  useEffect(() => {
    void load()
  }, [load])

  const globalProgress = housePercent(fulfillment?.progressPercent)
  const globalLabel = formatHousePercent(globalProgress)
  const periodProgress = asPercent(fulfillment?.period?.progressPercent)
  const activityStatus = fulfillment?.activityStatus
  const completedCount = activityStatus?.completed ?? 0
  const inProgressCount = activityStatus?.inProgress ?? 0
  const pendingCount = activityStatus?.pending ?? 0
  const statusTotal = completedCount + inProgressCount + pendingCount
  const periodLabel = fulfillment?.period
    ? `${formatShortDate(fulfillment.period.startDate || null) || '—'} → ${formatShortDate(fulfillment.period.endDate || null) || '—'}`
    : 'Sin periodo'

  const dateRangeLabel = useMemo(() => {
    if (!obra) return '—'
    const start = formatShortDate(obra.startDate)
    const end = formatShortDate(obra.estimatedEndDate)
    if (start && end) return `${start} - ${end}`
    return start || end || 'Sin fechas'
  }, [obra])

  async function toggleActive() {
    if (!obra) return
    try {
      const updated = await updateObra(obra.id, {
        isActive: obra.isActive === 1 ? 2 : 1,
      })
      setObra(updated)
      toast.success(updated.isActive === 1 ? 'Obra reactivada' : 'Obra dada de baja')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar estado')
    }
  }

  if (loading) return <p className={styles.empty}>Cargando obra…</p>
  if (error || !obra) {
    return (
      <div className={styles.page}>
        <Alert tone="error">{error || 'Obra no encontrada'}</Alert>
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          Volver al dashboard
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
            onClick={() => navigate('/dashboard')}
          >
            ← Inicio
          </button>
          <h1 className={styles.title}>{obra.name}</h1>
          <p className={styles.subtitle}>Vista General Del Proyecto</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.dateBox}>
            <CalendarIcon />
            <span className={styles.dateText}>{dateRangeLabel}</span>
          </div>
          <div className={styles.actionRow}>
            <Button variant="ghost" onClick={() => setEditOpen(true)}>
              Editar
            </Button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Cerrar sesión"
              onClick={() => void logout()}
            >
              <PowerIcon />
            </button>
          </div>
        </div>
      </header>

      <section className={styles.progressCard}>
        <h2 className={styles.sectionTitle}>Progreso de la construcción</h2>
        {(fulfillment?.zones ?? []).length === 0 ? (
          <p className={styles.muted}>No hay zonas activas.</p>
        ) : (
          <div className={styles.zoneBoard}>
            {(fulfillment?.zones ?? []).map((zone) => {
              const chapters = zone.chapters ?? []
              return (
                <div key={zone.zoneId} className={styles.zoneBlock}>
                  <p className={styles.zoneLabel}>{zone.zoneName}</p>
                  <div className={styles.stepper}>
                    {chapters.map((chapter, index) => {
                      const progress = asPercent(chapter.progressPercent)
                      const state =
                        progress >= 100 ? 'done' : progress > 0 ? 'current' : 'next'
                      const isLast = index === chapters.length - 1
                      return (
                        <div key={chapter.chapterId} className={styles.step}>
                          {!isLast ? <span className={styles.stepLine} /> : null}
                          <span
                            className={cn(
                              styles.stepDot,
                              state === 'done' && styles.stepDotDone,
                              state === 'current' && styles.stepDotCurrent,
                              state === 'next' && styles.stepDotNext,
                            )}
                            aria-label={`${chapter.chapterName} ${progress}%`}
                          >
                            <span className={styles.stepPercent}>{progress}%</span>
                          </span>
                          <p className={styles.stepName}>{chapter.chapterName}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className={styles.mainGrid}>
        <section className={styles.siteCard}>
          <div className={styles.siteHeader}>
            <h2 className={styles.siteTitle}>Sitio de trabajo</h2>
            <div className={styles.siteActions}>
              <button
                type="button"
                className={styles.menuDots}
                aria-label="Opciones"
                onClick={() => {
                  setAdminOpen(true)
                  setAdminTab('documentos')
                }}
              >
                ···
              </button>
            </div>
          </div>
          <div className={styles.siteMain}>
            <img
              className={styles.siteMainImg}
              src={resolveObraCover(obra)}
              alt=""
              onError={(e) => {
                e.currentTarget.src = coverForObra(obra.id)
              }}
            />
          </div>
          <div className={styles.thumbGrid}>
            {photosLoading ? (
              Array.from({ length: RECENT_PHOTO_COUNT }).map((_, index) => (
                <div key={index} className={styles.thumb} />
              ))
            ) : recentPhotos.length === 0 ? (
              <p className={styles.thumbEmpty}>Aún no hay fotos en esta obra.</p>
            ) : (
              recentPhotos.map((photo) => (
                <button
                  key={`${photo.kind || 'task'}-${photo.id}`}
                  type="button"
                  className={styles.thumbBtn}
                  title={photoCaption(photo)}
                  onClick={() =>
                    navigate(`/dashboard/obras/${obra.id}/galeria`)
                  }
                >
                  <img
                    className={styles.thumbImg}
                    src={photo.fileUrl}
                    alt={photoCaption(photo)}
                  />
                </button>
              ))
            )}
          </div>
          <div className={styles.photoActions}>
            <button
              type="button"
              className={styles.galleryBtn}
              onClick={() => navigate(`/dashboard/obras/${obra.id}/galeria`)}
            >
              Ver galería
            </button>
            <ObraPhotoUpload
              obraId={obra.id}
              label="Subir fotos"
              size="sm"
              onUploaded={() => void loadRecentPhotos()}
            />
          </div>
        </section>

        <div className={styles.rightColumn}>
          <section className={styles.metricsCard}>
            <div className={styles.metricCell}>
              <p className={styles.metricLabel}>% global obra ejecutada</p>
              <div className={styles.metricRow}>
                <div
                  className={styles.ring}
                  style={{ ['--pct' as string]: globalProgress }}
                >
                  <span
                    className={cn(
                      styles.ringValue,
                      globalLabel.length > 3 && styles.ringValueCompact,
                    )}
                  >
                    {globalLabel}
                  </span>
                </div>
              </div>
              <p className={styles.metricHint}>% de la obra</p>
            </div>
            <div className={styles.metricCell}>
              <p className={styles.metricLabel}>% cumplimiento bitácora actual</p>
              <div className={styles.metricRow}>
                <div
                  className={cn(styles.ring, styles.ringOrange)}
                  style={{ ['--pct' as string]: periodProgress }}
                >
                  <span className={styles.ringValue}>{periodProgress}</span>
                </div>
              </div>
              <p className={styles.metricHint}>{periodLabel}</p>
            </div>
            <div className={styles.metricCell}>
              <p className={styles.metricLabel}>Estado actividades</p>
              <div className={styles.metricRow}>
                <div
                  className={styles.ring}
                  style={activityDonutStyle(
                    completedCount,
                    inProgressCount,
                    pendingCount,
                  )}
                >
                  <span className={styles.ringValue}>{statusTotal}</span>
                </div>
                <ul className={styles.legend}>
                  <li className={styles.legendItem}>
                    <span className={styles.legendLeft}>
                      <span className={styles.legendDot} style={{ background: '#054c09' }} />
                      Completadas
                    </span>
                    <span>{completedCount}</span>
                  </li>
                  <li className={styles.legendItem}>
                    <span className={styles.legendLeft}>
                      <span className={styles.legendDot} style={{ background: '#d95a0c' }} />
                      En progreso
                    </span>
                    <span>{inProgressCount}</span>
                  </li>
                  <li className={styles.legendItem}>
                    <span className={styles.legendLeft}>
                      <span className={styles.legendDot} style={{ background: '#c8c8c8' }} />
                      Pendientes
                    </span>
                    <span>{pendingCount}</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className={styles.tasksCard}>
            <div className={styles.tasksHeader}>
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
                Asistencia de hoy
                {asistenciaHoy.length > 0
                  ? ` (${asistenciaHoy.length})`
                  : ''}
              </h2>
              <button
                type="button"
                className={styles.newTaskBtn}
                onClick={() => setAsistenciaOpen(true)}
              >
                Registrar llegada
              </button>
            </div>
            {asistenciaLoading ? (
              <div className={styles.tasksEmpty}>
                <p>Cargando…</p>
              </div>
            ) : asistenciaHoy.length === 0 ? (
              <div className={styles.tasksEmpty}>
                <p>Nadie ha llegado todavía hoy.</p>
                <button
                  type="button"
                  className={styles.seeAll}
                  onClick={() => setAsistenciaOpen(true)}
                >
                  Registrar primera llegada →
                </button>
              </div>
            ) : (
              <>
                <table className={styles.tasksTable}>
                  <thead>
                    <tr>
                      <th>Trabajador</th>
                      <th>Entrada</th>
                      <th>Registró</th>
                      <th>Acuse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asistenciaHoy.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.workerName || `Trabajador #${item.workerId}`}
                          </strong>
                          {item.positionName || item.documentNumber ? (
                            <div className={styles.asistenciaMeta}>
                              {[item.documentNumber, item.positionName]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          ) : null}
                        </td>
                        <td>{formatAttendanceTime(item.signedAt)}</td>
                        <td>
                          {item.recordedByName || `#${item.recordedBy}`}
                        </td>
                        <td>
                          {item.signatureData?.startsWith('data:image/') ? (
                            <img
                              src={item.signatureData}
                              alt={`Firma de ${item.workerName || 'entrada'}`}
                              className={styles.asistenciaFirma}
                            />
                          ) : (
                            <span className={styles.asistenciaMeta}>
                              {item.signatureType === 'acknowledgment' ||
                              item.signatureData
                                ? 'Admin'
                                : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  className={styles.seeAll}
                  onClick={() => setAsistenciaOpen(true)}
                >
                  Ver / registrar asistencia →
                </button>
              </>
            )}
          </section>

          <section className={styles.tasksCard}>
            <div className={styles.tasksHeader}>
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
                Actividades de la obra
              </h2>
            </div>
            <div className={styles.tasksEmpty}>
              <p>
                El avance por capítulo, el subcapítulo, la zona y quitar las
                que no aplican están en su propia vista.
              </p>
              <button
                type="button"
                className={styles.seeAll}
                onClick={() =>
                  navigate(`/dashboard/obras/${obra.id}/actividades`)
                }
              >
                Ver actividades de la obra →
              </button>
            </div>
          </section>

          <section className={styles.tasksCard}>
            <div className={styles.tasksHeader}>
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
                Planificación
              </h2>
              <button
                type="button"
                className={styles.newTaskBtn}
                onClick={() =>
                  navigate(`/dashboard/obras/${obra.id}/planes?nuevo=1`)
                }
              >
                + Nuevo plan
              </button>
            </div>
            {planesLoading ? (
              <div className={styles.tasksEmpty}>
                <p>Cargando…</p>
              </div>
            ) : planesRecientes.length === 0 ? (
              <div className={styles.tasksEmpty}>
                <p>Aún no hay planes en esta obra.</p>
                <button
                  type="button"
                  className={styles.seeAll}
                  onClick={() =>
                    navigate(`/dashboard/obras/${obra.id}/planes?nuevo=1`)
                  }
                >
                  Crear primer plan →
                </button>
              </div>
            ) : (
              <>
                <table className={styles.tasksTable}>
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Periodo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planesRecientes.map((plan) => (
                      <tr
                        key={plan.id}
                        className={styles.planRow}
                        onClick={() => navigate(`/dashboard/planes/${plan.id}`)}
                      >
                        <td>
                          <strong>{plan.name}</strong>
                          {plan.currentVersionNumber ? (
                            <div className={styles.asistenciaMeta}>
                              v{plan.currentVersionNumber}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {formatPlanDate(plan.startDate)} →{' '}
                          {formatPlanDate(plan.endDate)}
                        </td>
                        <td>
                          <Badge tone={planStatusTone(plan.status)}>
                            {WORK_PLAN_STATUS_LABELS[plan.status]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  className={styles.seeAll}
                  onClick={() => navigate(`/dashboard/obras/${obra.id}/planes`)}
                >
                  Ver todos los planes →
                </button>
              </>
            )}
          </section>
        </div>
      </div>

      <div className={styles.adminBar}>
        <Button
          variant="ghost"
          onClick={() => {
            setAdminOpen((open) => !open)
            setAdminTab('clientes')
          }}
        >
          {adminOpen ? 'Ocultar administración' : 'Administrar obra'}
        </Button>
        {canDeactivateObra ? (
          <Button
            variant={obra.isActive === 1 ? 'danger' : 'ghost'}
            onClick={() => void toggleActive()}
          >
            {obra.isActive === 1 ? 'Dar de baja' : 'Reactivar'}
          </Button>
        ) : null}
        <Badge tone={obra.isActive === 1 ? 'success' : 'danger'}>
          {obra.isActive === 1 ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      {adminOpen ? (
        <div className={styles.adminPanel}>
          <div className={styles.tabs} role="tablist">
            {(
              [
                ['clientes', 'Clientes'],
                ['documentos', 'Documentos'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                className={cn(styles.tab, adminTab === key && styles.tabActive)}
                onClick={() => setAdminTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {adminTab === 'clientes' ? <ClientesTab obraId={obra.id} /> : null}
          {adminTab === 'documentos' ? <DocumentosTab obraId={obra.id} /> : null}
        </div>
      ) : null}

      <ObraFormModal
        open={editOpen}
        obra={obra}
        onClose={() => setEditOpen(false)}
        onSaved={(next) => setObra(next)}
      />

      <AsistenciaModal
        open={asistenciaOpen}
        obraId={obra.id}
        obraName={obra.name}
        excludeWorkerIds={asistenciaHoy.map((item) => item.workerId)}
        onClose={() => setAsistenciaOpen(false)}
        onChanged={() => void loadAsistenciaHoy()}
      />
    </div>
  )
}

function photoCaption(photo: GalleryPhoto): string {
  if (photo.kind === 'obra') return photo.description || 'Foto de la obra'
  if (photo.subtaskName) return `${photo.taskName} · ${photo.subtaskName}`
  return photo.taskName
}

function housePercent(value: number | string | null | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(100, Math.round(parsed * 100) / 100))
}

function formatHousePercent(value: number): string {
  return value.toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function asPercent(value: number | string | null | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(100, Math.round(parsed)))
}

function activityDonutStyle(
  completed: number,
  inProgress: number,
  pending: number,
): { background: string } {
  const total = completed + inProgress + pending
  if (total === 0) {
    return { background: 'conic-gradient(#ececec 0 100%)' }
  }
  const completedEnd = (completed / total) * 100
  const progressEnd = completedEnd + (inProgress / total) * 100
  return {
    background: `conic-gradient(#054c09 0 ${completedEnd}%, #d95a0c ${completedEnd}% ${progressEnd}%, #c8c8c8 ${progressEnd}% 100%)`,
  }
}

function formatShortDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('es-CO', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

function CalendarIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 18 20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 0h2v2h2V0h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h3V0Zm10 8H2v10h14V8Z"
        opacity="0.7"
      />
    </svg>
  )
}

function PowerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13 3h-2v10h2V3Zm4.6 2.4-1.4 1.4A7 7 0 1 1 7.8 6.8L6.4 5.4a9 9 0 1 0 11.2 0Z"
      />
    </svg>
  )
}

function ClientesTab({ obraId }: { obraId: number }) {
  const toast = useToast()
  const [items, setItems] = useState<ObraClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [personQuery, setPersonQuery] = useState('')
  const debouncedQuery = useDebouncedValue(personQuery)
  const [personResults, setPersonResults] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [role, setRole] = useState('comprador')
  const [isPrimary, setIsPrimary] = useState(false)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listObraClients(obraId, { currentOnly: true })
      setItems(data.clients)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar clientes')
    } finally {
      setLoading(false)
    }
  }, [obraId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!open || debouncedQuery.trim().length < 2) {
      setPersonResults([])
      return
    }
    void listPersons({ page: 1, search: debouncedQuery })
      .then((data) => setPersonResults(data.persons))
      .catch(() => setPersonResults([]))
  }, [open, debouncedQuery])

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!selectedPerson) {
      setFormError('Selecciona una persona.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await addObraClient(obraId, {
        personId: selectedPerson.id,
        role,
        isPrimary: isPrimary ? 1 : 0,
        startDate: startDate || null,
      })
      toast.success('Cliente asociado')
      setOpen(false)
      await load()
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'No se pudo asociar',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <div className={styles.toolbar}>
        <p className={styles.muted}>Asocia personas a la obra.</p>
        <Button onClick={() => setOpen(true)}>Asociar cliente</Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Sin clientes vigentes.</p>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((client) => (
            <article key={client.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.cardTitle}>
                    {client.personName || `Persona #${client.personId}`}
                  </h3>
                  <p className={styles.cardSubtitle}>
                    {client.documentNumber || 's/d'} · {client.role}
                  </p>
                </div>
                {client.isPrimary === 1 ? <Badge tone="success">Primario</Badge> : null}
              </div>
              <div className={styles.rowActions}>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    void closeObraClient(client.id)
                      .then(() => load())
                      .then(() => toast.success('Vínculo cerrado'))
                  }
                >
                  Cerrar vínculo
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        title="Asociar cliente"
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="client-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Asociar'}
            </Button>
          </>
        }
      >
        <form id="client-form" className={styles.formGrid} onSubmit={handleAdd}>
          <Field label="Buscar persona">
            <TextInput
              value={personQuery}
              onChange={(e) => setPersonQuery(e.target.value)}
            />
          </Field>
          <div className={styles.personResults}>
            {personResults.map((person) => (
              <button
                key={person.id}
                type="button"
                className={cn(
                  styles.personOption,
                  selectedPerson?.id === person.id && styles.personOptionSelected,
                )}
                onClick={() => setSelectedPerson(person)}
              >
                <strong>{person.name}</strong>
                <span>{person.documentNumber}</span>
              </button>
            ))}
          </div>
          <Field label="Rol">
            <TextSelect value={role} onChange={(e) => setRole(e.target.value)}>
              {CLIENT_ROLES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="Desde">
            <TextInput
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <label className={styles.muted}>
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />{' '}
            Cliente primario
          </label>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>
    </section>
  )
}

type DocumentDraft = {
  key: string
  file: File
  name: string
  description: string
  visible: boolean
}

function fileTitle(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim()
  return base || name || 'Archivo'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentosTab({ obraId }: { obraId: number }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<ObraDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [drafts, setDrafts] = useState<DocumentDraft[]>([])
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const docs = await listObraDocuments(obraId)
      setItems(docs.documents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar documentos')
    } finally {
      setLoading(false)
    }
  }, [obraId])

  useEffect(() => {
    void load()
  }, [load])

  function closeForm() {
    setOpen(false)
    setDrafts([])
    setFormError(null)
  }

  async function addFiles(selected: File[]) {
    if (!selected.length) return
    if (drafts.length + selected.length > 10) {
      setFormError('Puedes subir hasta 10 archivos, de 25 MB cada uno.')
      return
    }
    setPreparing(true)
    setFormError(null)
    const next: DocumentDraft[] = []
    try {
      for (const file of selected) {
        const prepared = await prepareDocumentFile(file)
        next.push({
          key: `${prepared.name}-${prepared.size}-${Date.now()}-${next.length}`,
          file: prepared,
          name: fileTitle(file.name),
          description: '',
          visible: false,
        })
      }
      setDrafts((current) => [...current, ...next])
    } catch (err) {
      setFormError(
        err instanceof DocumentPrepareError
          ? err.message
          : 'No se pudo preparar un archivo',
      )
    } finally {
      setPreparing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function updateDraft(key: string, patch: Partial<DocumentDraft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)),
    )
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!drafts.length) {
      setFormError('Elige al menos un archivo.')
      return
    }
    if (drafts.some((draft) => !draft.name.trim())) {
      setFormError('Cada archivo necesita un nombre.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await uploadObraDocuments(
        obraId,
        drafts.map((draft) => ({
          file: draft.file,
          name: draft.name.trim(),
          description: draft.description.trim(),
          visible: draft.visible,
        })),
      )
      toast.success(drafts.length === 1 ? 'Archivo guardado' : `${drafts.length} archivos guardados`)
      closeForm()
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudieron guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <div className={styles.toolbar}>
        <p className={styles.muted}>
          Máximo 10 archivos, de 25 MB cada uno. Las imágenes se comprimen al guardarlas.
        </p>
        <Button
          onClick={() => {
            setDrafts([])
            setFormError(null)
            setOpen(true)
          }}
        >
          Subir archivos
        </Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Sin documentos.</p>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((doc) => (
            <article key={doc.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.cardTitle}>{doc.name}</h3>
                  {doc.description ? (
                    <p className={styles.cardSubtitle}>{doc.description}</p>
                  ) : null}
                </div>
                <Badge tone={doc.isVisibleToClient === 1 ? 'success' : 'neutral'}>
                  {doc.isVisibleToClient === 1 ? 'Visible' : 'Interno'}
                </Badge>
              </div>
              <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                Abrir archivo
              </a>
              <div className={styles.rowActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void updateObraDocument(doc.id, {
                      isVisibleToClient: doc.isVisibleToClient === 1 ? 0 : 1,
                    }).then(() => load())
                  }
                >
                  Alternar visibilidad
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        title="Subir archivos"
        open={open}
        onClose={closeForm}
        footer={
          <>
            <Button variant="ghost" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" form="doc-form" disabled={saving || preparing || drafts.length === 0}>
              {saving ? 'Guardando…' : preparing ? 'Comprimiendo…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="doc-form" className={styles.formGrid} onSubmit={handleCreate}>
          <p className={styles.muted}>
            Hasta 10 archivos, de 25 MB cada uno. Un plano, un PDF o una imagen.
            Las imágenes se comprimen antes de subirlas.
          </p>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(event) => void addFiles(Array.from(event.target.files ?? []))}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={preparing || saving || drafts.length >= 10}
            onClick={() => fileRef.current?.click()}
          >
            Elegir archivos
          </Button>
          {drafts.length > 0 ? (
            <div className={styles.docDrafts}>
              {drafts.map((draft) => (
                <div key={draft.key} className={styles.docDraft}>
                  <div className={styles.docDraftHead}>
                    <span>{draft.file.name}</span>
                    <span>{formatFileSize(draft.file.size)}</span>
                  </div>
                  <Field label="Nombre">
                    <TextInput
                      required
                      value={draft.name}
                      onChange={(event) => updateDraft(draft.key, { name: event.target.value })}
                    />
                  </Field>
                  <Field label="Descripción">
                    <TextArea
                      value={draft.description}
                      onChange={(event) =>
                        updateDraft(draft.key, { description: event.target.value })
                      }
                    />
                  </Field>
                  <label className={styles.muted}>
                    <input
                      type="checkbox"
                      checked={draft.visible}
                      onChange={(event) =>
                        updateDraft(draft.key, { visible: event.target.checked })
                      }
                    />{' '}
                    Visible al cliente
                  </label>
                </div>
              ))}
            </div>
          ) : null}
          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>
    </section>
  )
}
