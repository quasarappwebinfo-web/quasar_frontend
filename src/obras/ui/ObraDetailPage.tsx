import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
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
import { ObraChaptersModal } from '@/obras/ui/ObraChaptersModal'
import { coverForObra, OBRA_STATUS_OPTIONS, resolveObraCover } from '@/obras/lib/obraUi'
import type { Obra, ObraClient, ObraDocument } from '@/obras/model/types'
import {
  DocumentPrepareError,
  prepareDocumentFile,
} from '@/shared/lib/prepareDocument'
import { ObraFormModal } from '@/obras/ui/ObraFormModal'
import { AsistenciaModal } from '@/obras/ui/AsistenciaModal'
import { listObraAttendance } from '@/obras/api/asistenciaApi'
import { compareChapterNames } from '@/task-pool/lib/chapterOrder'
import {
  formatAttendanceTime,
  todayColombiaIso,
} from '@/obras/lib/asistenciaUi'
import asistenciaPersonas from '@/shared/assets/asistencia-personas.png'
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
  const [chaptersOpen, setChaptersOpen] = useState(false)
  const [asistenciaOpen, setAsistenciaOpen] = useState(false)
  const [asistenciaHoy, setAsistenciaHoy] = useState<ObraDailyAttendance[]>([])
  const [asistenciaLoading, setAsistenciaLoading] = useState(false)
  const [planesRecientes, setPlanesRecientes] = useState<WorkPlan[]>([])
  const [planesLoading, setPlanesLoading] = useState(false)
  const [recentPhotos, setRecentPhotos] = useState<GalleryPhoto[]>([])
  const [photoTotal, setPhotoTotal] = useState(0)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [responsibleName, setResponsibleName] = useState<string | null>(null)
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
      setPhotoTotal(data.pagination.totalItems)
    } catch {
      setRecentPhotos([])
      setPhotoTotal(0)
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
      void listObraClients(id, { currentOnly: true })
        .then((data) => {
          const primary =
            data.clients.find((client) => client.isPrimary === 1) ?? data.clients[0]
          setResponsibleName(primary?.personName ?? null)
        })
        .catch(() => setResponsibleName(null))
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
    ? formatPeriodSpan(fulfillment.period.startDate, fulfillment.period.endDate)
    : 'Sin periodo'

  const activityFill =
    statusTotal === 0
      ? 0
      : Math.round(((completedCount + inProgressCount) / statusTotal) * 100)
  const presentCount = asistenciaHoy.length
  const visibleThumbs = recentPhotos.slice(0, 3)
  const hiddenPhotos = Math.max(0, photoTotal - visibleThumbs.length)
  const latestStamp = recentPhotos[0]?.takenAt || recentPhotos[0]?.createdAt || null
  const statusLabel =
    obra && obra.isActive === 1 ? obraStatusLabel(obra.status) : 'Inactiva'
  const statusTone =
    !obra || obra.isActive !== 1 ? 'inactive' : obra.status || 'planning'

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
      <button
        type="button"
        className={styles.back}
        onClick={() => navigate('/dashboard')}
      >
        ← Volver a obras
      </button>

      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <img
            className={styles.heroThumb}
            src={resolveObraCover(obra)}
            alt=""
            onError={(event) => {
              event.currentTarget.src = coverForObra(obra.id)
            }}
          />
          <div className={styles.heroCopy}>
            <div className={styles.heroTitleRow}>
              <h1 className={styles.title}>{obra.name}</h1>
              <span className={cn(styles.statusPill, styles[`status_${statusTone}`])}>
                {statusLabel}
              </span>
            </div>
            <p className={styles.subtitle}>Vista General Del Proyecto</p>
            <p className={styles.heroMeta}>
              <span>Inicio: {formatMetaDate(obra.startDate) || '—'}</span>
              <span>Fin estimado: {formatMetaDate(obra.estimatedEndDate) || '—'}</span>
              <span>Responsable: {responsibleName || 'Sin asignar'}</span>
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {canDeactivateObra ? (
            <button
              type="button"
              className={cn(styles.editBtn, obra.isActive === 1 && styles.dangerBtn)}
              onClick={() => void toggleActive()}
            >
              {obra.isActive === 1 ? 'Dar de baja' : 'Reactivar'}
            </button>
          ) : null}
          <div className={styles.actionRow}>
            {canDeactivateObra ? (
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => setChaptersOpen(true)}
              >
                Capítulos
              </button>
            ) : null}
            <button type="button" className={styles.editBtn} onClick={() => setEditOpen(true)}>
              <PencilIcon />
              Editar
            </button>
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

      <section className={styles.kpiRow} aria-label="Indicadores de la obra">
        <article className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <div
              className={cn(styles.ring, styles.ringBlue)}
              style={{ ['--pct' as string]: globalProgress }}
            >
              <span
                className={cn(
                  styles.ringValue,
                  globalLabel.includes(',') && styles.ringValueSmall,
                )}
              >
                {globalLabel}%
              </span>
            </div>
            <div>
              <h2 className={styles.kpiTitle}>Avance Global de Obra</h2>
              <p className={styles.kpiHint}>Ejecución ponderada del proyecto</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.kpiLink}
            onClick={() => document.getElementById('progreso')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <ChartIcon /> Ver detalle →
          </button>
        </article>
        <article className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <div
              className={cn(styles.ring, styles.ringOrange)}
              style={{ ['--pct' as string]: periodProgress }}
            >
              <span className={styles.ringValue}>{periodProgress}%</span>
            </div>
            <div>
              <h2 className={styles.kpiTitle}>Cumplimiento Bitácora</h2>
              <p className={styles.kpiHint}>Periodo: {periodLabel}</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.kpiLink}
            onClick={() =>
              navigate(
                fulfillment?.period?.planId
                  ? `/dashboard/planes/${fulfillment.period.planId}`
                  : `/dashboard/obras/${obra.id}/tareas`,
              )
            }
          >
            Ver detalle →
          </button>
        </article>
        <article className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <div
              className={cn(styles.ring, styles.ringBlue)}
              style={{ ['--pct' as string]: activityFill }}
            >
              <span className={styles.ringValue}>{statusTotal}</span>
            </div>
            <div>
              <h2 className={styles.kpiTitle}>Actividades</h2>
              <p className={styles.kpiHint}>Total registradas</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.kpiLink}
            onClick={() => navigate(`/dashboard/obras/${obra.id}/actividades`)}
          >
            Ver tablero →
          </button>
        </article>
        <article className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <div className={cn(styles.ring, styles.ringGreen)} style={{ ['--pct' as string]: 100 }}>
              <span className={styles.ringValue}>{presentCount}</span>
            </div>
            <div>
              <h2 className={styles.kpiTitle}>Personal Presente</h2>
              <p className={styles.kpiHint}>Registros de hoy</p>
            </div>
          </div>
          <button type="button" className={styles.kpiLink} onClick={() => setAsistenciaOpen(true)}>
            Registrar llegada
          </button>
        </article>
      </section>

      <section className={styles.progressCard} id="progreso">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>
            <ChartIcon /> Progreso de la Construcción
          </h2>
        </div>
        {(fulfillment?.zones ?? []).length === 0 ? (
          <p className={styles.muted}>No hay zonas activas.</p>
        ) : (
          <div className={styles.zoneBoard}>
            {(fulfillment?.zones ?? []).map((zone) => {
              const chapters = [...(zone.chapters ?? [])].sort((left, right) =>
                compareChapterNames(left.chapterName, right.chapterName),
              )
              const started = chapters.filter((chapter) => asPercent(chapter.progressPercent) > 0).length
              return (
                <div key={zone.zoneId} className={styles.zoneRow}>
                  <div className={styles.zoneName}>
                    <HouseIcon />
                    <div>
                      <strong>{zone.zoneName}</strong>
                      <span>
                        {zone.weightPercent == null
                          ? 'Sin porcentaje de la obra'
                          : `${asPercent(zone.weightPercent)}% de la obra`}
                      </span>
                      <span>
                        {started} de {chapters.length} etapas iniciadas
                      </span>
                    </div>
                  </div>
                  <div className={styles.chapterTrack}>
                    {chapters.map((chapter) => {
                      const progress = asPercent(chapter.progressPercent)
                      const tone =
                        progress >= 100 ? styles.barDone : progress > 0 ? styles.barCurrent : ''
                      return (
                        <div key={chapter.chapterId} className={styles.chapterCell}>
                          <p>{chapter.chapterName}</p>
                          <strong>{progress}%</strong>
                          <span className={styles.barTrack}>
                            <span className={cn(styles.barFill, tone)} style={{ width: `${progress}%` }} />
                          </span>
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
        <div className={styles.leftColumn}>
        <section className={styles.siteCard}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>
              <CameraIcon /> Sitio de Trabajo
            </h2>
            <button
              type="button"
              className={styles.panelLink}
              onClick={() => navigate(`/dashboard/obras/${obra.id}/galeria`)}
            >
              Ver galería →
            </button>
          </div>
          <div className={styles.siteFrame}>
            <img
              className={styles.siteMainImg}
              src={resolveObraCover(obra)}
              alt=""
              onError={(event) => {
                event.currentTarget.src = coverForObra(obra.id)
              }}
            />
            {latestStamp ? (
              <p className={styles.siteStamp}>
                <CameraIcon /> Última actualización: {formatMetaDate(latestStamp) || latestStamp}
              </p>
            ) : null}
          </div>
          <div className={styles.thumbRow}>
            {photosLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className={styles.thumb} />
              ))
            ) : visibleThumbs.length === 0 ? (
              <p className={styles.thumbEmpty}>Aún no hay fotos en esta obra.</p>
            ) : (
              <>
                {visibleThumbs.map((photo) => (
                  <button
                    key={`${photo.kind || 'task'}-${photo.id}`}
                    type="button"
                    className={styles.thumbBtn}
                    title={photoCaption(photo)}
                    onClick={() => navigate(`/dashboard/obras/${obra.id}/galeria`)}
                  >
                    <img className={styles.thumbImg} src={photo.fileUrl} alt={photoCaption(photo)} />
                  </button>
                ))}
                {hiddenPhotos > 0 ? (
                  <button
                    type="button"
                    className={styles.morePhotos}
                    onClick={() => navigate(`/dashboard/obras/${obra.id}/galeria`)}
                  >
                    +{hiddenPhotos}
                  </button>
                ) : null}
              </>
            )}
          </div>
          <div className={styles.uploadSlot}>
            <ObraPhotoUpload
              obraId={obra.id}
              label="Subir fotos"
              size="sm"
              onUploaded={() => void loadRecentPhotos()}
            />
          </div>
        </section>
        </div>

        <div className={styles.rightColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                <FileIcon /> Documentos
              </h2>
            </div>
            <DocumentosTab obraId={obra.id} />
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                <PeopleIcon /> Asistencia de hoy
              </h2>
              <div className={styles.attendanceActions}>
                <button
                  type="button"
                  className={styles.panelLink}
                  onClick={() => navigate(`/dashboard/obras/${obra.id}/asistencia`)}
                >
                  Ver tablero →
                </button>
                <button
                  type="button"
                  className={styles.arriveBtn}
                  onClick={() => setAsistenciaOpen(true)}
                >
                  Registrar llegada
                </button>
              </div>
            </div>
            {asistenciaLoading ? (
              <p className={styles.muted}>Cargando…</p>
            ) : (
              <div className={styles.attendanceBody}>
                <div>
                  <p className={styles.attendanceCount}>{presentCount}</p>
                  <p className={styles.attendanceLabel}>Personal registrado</p>
                  {asistenciaHoy.length > 0 ? (
                    <ul className={styles.attendanceList}>
                      {asistenciaHoy.slice(0, 4).map((item) => (
                        <li key={item.id}>
                          <strong>{item.workerName || `Trabajador #${item.workerId}`}</strong>
                          <span>{formatAttendanceTime(item.signedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.attendanceWarn}>
                      Aún no se han registrado asistencias hoy
                    </p>
                  )}
                </div>
                <img
                  className={styles.attendanceArt}
                  src={asistenciaPersonas}
                  alt=""
                />
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                <BoardIcon /> Actividades de la obra
              </h2>
              <button
                type="button"
                className={styles.panelLink}
                onClick={() => navigate(`/dashboard/obras/${obra.id}/actividades`)}
              >
                Ir al tablero →
              </button>
            </div>
            <p className={styles.panelNote}>
              El detalle por capítulo, subcapítulo y zona se encuentra en el tablero de actividades.
            </p>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                <BoardIcon /> Planificación
              </h2>
              <button
                type="button"
                className={styles.panelLink}
                onClick={() => navigate(`/dashboard/obras/${obra.id}/tareas`)}
              >
                Ver todas →
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
                    navigate(`/dashboard/obras/${obra.id}/tareas?nuevo=1`)
                  }
                >
                  Crear primer plan →
                </button>
              </div>
            ) : (
              <ul className={styles.planList}>
                {planesRecientes.map((plan) => (
                  <li key={plan.id}>
                    <button
                      type="button"
                      className={styles.planItem}
                      onClick={() => navigate(`/dashboard/planes/${plan.id}`)}
                    >
                      <span className={styles.planName}>{plan.name}</span>
                      <span className={styles.planVersion}>
                        {plan.currentVersionNumber ? `v${plan.currentVersionNumber}` : '—'}
                      </span>
                      <span className={styles.planDates}>
                        {formatPlanDate(plan.startDate)} – {formatPlanDate(plan.endDate)}
                      </span>
                      <Badge tone={planStatusTone(plan.status)}>
                        {WORK_PLAN_STATUS_LABELS[plan.status]}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ObraFormModal
        open={editOpen}
        obra={obra}
        onClose={() => setEditOpen(false)}
        onSaved={(next) => setObra(next)}
      />

      <ObraChaptersModal
        open={chaptersOpen}
        obraId={obra.id}
        onClose={() => setChaptersOpen(false)}
        onSaved={() => {
          void getObraFulfillment(obra.id)
            .then((data) => setFulfillment(data))
            .catch(() => undefined)
        }}
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
  const rounded = Math.round(value * 100) / 100
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function asPercent(value: number | string | null | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(100, Math.round(parsed)))
}

function obraStatusLabel(status: string): string {
  return OBRA_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatMetaDate(value: string | null | undefined): string | null {
  const date = parseDate(value)
  if (!date) return null
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatPeriodSpan(start: string | null | undefined, end: string | null | undefined): string {
  const from = parseDate(start)
  const to = parseDate(end)
  if (!from && !to) return 'Sin periodo'
  const short = (date: Date) =>
    date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', '')
  if (from && to) return `${short(from)} – ${short(to)}`
  return short(from || to!)
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

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"
      />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 19h16v2H2V3h2v16Zm4-6h2v4H8v-4Zm4-5h2v9h-2V8Zm4 3h2v6h-2v-6Z" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 2h8l6 6v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V9h5.5L13 3.5ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Z"
      />
    </svg>
  )
}

function HouseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 3 3 11h2v9h6v-6h2v6h6v-9h2L12 3Z" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 4 7.2 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.2L15 4H9Zm3 13a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
      />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm6 1a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 15 13ZM9 14c-3.3 0-6 1.8-6 4v2h12v-2c0-2.2-2.7-4-6-4Zm6 .5c-.4 0-.8 0-1.2.1 1.4.9 2.2 2 2.2 3.4V20h6v-1.5c0-2.1-2.5-4-7-4Z"
      />
    </svg>
  )
}

function BoardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 3h16a1 1 0 0 1 1 1v16l-4-2-4 2-4-2-4 2V4a1 1 0 0 1 1-1Zm3 5h10v2H7V8Zm0 4h7v2H7v-2Z" />
    </svg>
  )
}

export function ClientesTab({ obraId }: { obraId: number }) {
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
