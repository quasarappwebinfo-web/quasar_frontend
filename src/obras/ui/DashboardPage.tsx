import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listActiveStages } from '@/obras/api/catalogosObrasApi'
import { listObras } from '@/obras/api/obrasApi'
import { isObraActiveWork, isObraDelayed } from '@/obras/lib/obraUi'
import type { Obra, StageOption } from '@/obras/model/types'
import { ObraCard } from '@/obras/ui/ObraCard'
import { ObraFormModal } from '@/obras/ui/ObraFormModal'
import { listAssignments } from '@/rrhh/api/asignacionesApi'
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyNotificationsChanged,
  type UserNotification,
} from '@/app/ui/Sidebar/notificationsApi'
import { useAuth } from '@/auth'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { Alert, Button, PaginationBar } from '@/shared/ui'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  useDocumentTitle('Quasar · Dashboard')

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useState(1)
  const [obras, setObras] = useState<Obra[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [stages, setStages] = useState<StageOption[]>([])
  const [peopleByObra, setPeopleByObra] = useState<Record<number, number>>({})
  const [peopleTotal, setPeopleTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [notices, setNotices] = useState<UserNotification[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [obrasData, stagesData, assignmentsData] = await Promise.all([
        listObras({
          page,
          search: debouncedSearch,
          activeOnly: true,
        }),
        listActiveStages(),
        listAssignments({ page: 1, currentOnly: true }),
      ])
      setObras(obrasData.obras)
      setTotalItems(obrasData.pagination.totalItems)
      setItemsPerPage(obrasData.pagination.itemsPerPage)
      setStages(stagesData)

      const counts: Record<number, number> = {}
      for (const assignment of assignmentsData.assignments) {
        counts[assignment.obraId] = (counts[assignment.obraId] || 0) + 1
      }
      setPeopleByObra(counts)
      setPeopleTotal(assignmentsData.assignments.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  const loadNotices = useCallback(async () => {
    try {
      const data = await listMyNotifications()
      setNotices(data.notifications)
    } catch {
      setNotices([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadNotices()
  }, [loadNotices])

  const kpis = useMemo(() => {
    const active = obras.filter(isObraActiveWork)
    const delayed = active.filter(isObraDelayed)
    const onTime = active.length - delayed.length
    const pct = (n: number) =>
      active.length === 0 ? '—' : `${Math.round((n / active.length) * 100)}% de los proyectos`
    return {
      activeCount: totalItems,
      peopleTotal,
      onTime,
      delayed: delayed.length,
      onTimeHint: pct(onTime),
      delayedHint: pct(delayed.length),
    }
  }, [obras, totalItems, peopleTotal])

  const unreadNotices = notices.filter((notice) => !notice.readAt)

  async function markSeen(notice: UserNotification) {
    if (notice.readAt) return
    setNotices((items) => items.filter((item) => item.id !== notice.id))
    await markNotificationRead(notice.id)
    notifyNotificationsChanged()
    await loadNotices()
  }

  async function markAllSeen() {
    setNotices([])
    await markAllNotificationsRead()
    notifyNotificationsChanged()
    await loadNotices()
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>
            Vista general de todos los proyectos activos/construidos
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBox}>
            <input
              type="search"
              placeholder="Buscar...."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              aria-label="Buscar obras"
            />
            <SearchIcon className={styles.searchIcon} />
          </div>
          <div className={styles.actionRow}>
            {hasPermission('catalogos') || hasPermission('obras') ? (
              <Button variant="ghost" onClick={() => navigate('/dashboard/maestros')}>
                Configuración Global
              </Button>
            ) : null}
            {hasPermission('task_pool') || hasPermission('catalogos') ? (
              <Button
                variant="ghost"
                onClick={() => navigate('/maestros/task-pool')}
              >
                Base Datos Actividades
              </Button>
            ) : null}
            {hasPermission('obras') ? (
              <Button onClick={() => setFormOpen(true)}>Nueva obra</Button>
            ) : null}
          </div>
        </div>
      </header>

      {unreadNotices.length > 0 ? (
        <section className={styles.noticePanelHot} aria-label="Notificaciones">
          <div className={styles.noticeHead}>
            <div className={styles.noticeTitleBlock}>
              <h2 className={styles.noticeHeading}>Notificaciones</h2>
              <p className={styles.noticeLead}>
                {`Tienes ${unreadNotices.length} ${unreadNotices.length === 1 ? 'nota sin ver' : 'notas sin ver'}.`}
              </p>
            </div>
            <span className={styles.noticeBadge}>{unreadNotices.length} sin ver</span>
            {unreadNotices.length > 1 ? (
              <Button variant="ghost" size="sm" onClick={() => void markAllSeen()}>
                Marcar todas como vistas
              </Button>
            ) : null}
          </div>
          <ul className={styles.noticeList}>
            {unreadNotices.map((notice) => (
              <li key={notice.id} className={styles.noticeCard}>
                <div className={styles.noticeCopy}>
                  <p className={styles.noticeTitle}>{notice.title}</p>
                  <p className={styles.noticeBody}>{notice.body}</p>
                </div>
                <div className={styles.noticeActions}>
                  {notice.link ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        void markSeen(notice)
                        navigate(notice.link as string)
                      }}
                    >
                      Abrir actividad
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void markSeen(notice)}
                  >
                    Marcar como vista
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Proyectos activos</p>
          <p className={styles.kpiValue}>{kpis.activeCount}</p>
          <p className={styles.kpiHint}>Todos los proyectos activos a hoy</p>
          <img
            className={`${styles.kpiIcon} ${styles.kpiIconHouse}`}
            src="/dashboard/kpi-proyectos.svg"
            alt=""
            width={50}
            height={39}
          />
        </article>
        <article className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Personal en sitio hoy</p>
          <p className={styles.kpiValue}>{kpis.peopleTotal}</p>
          <p className={styles.kpiHint}>Distribuidos en todos los proyectos</p>
          <img
            className={`${styles.kpiIcon} ${styles.kpiIconPeople}`}
            src="/dashboard/kpi-personal.svg"
            alt=""
            width={50}
            height={35}
          />
        </article>
        <article className={styles.kpiCard}>
          <p className={styles.kpiLabel}>A tiempo</p>
          <p className={styles.kpiValue}>{kpis.onTime}</p>
          <p className={styles.kpiHint}>{kpis.onTimeHint}</p>
          <img
            className={`${styles.kpiIcon} ${styles.kpiIconStatus}`}
            src="/dashboard/kpi-atiempo.svg"
            alt=""
            width={48}
            height={48}
          />
        </article>
        <article className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Retrasadas</p>
          <p className={styles.kpiValue}>{kpis.delayed}</p>
          <p className={styles.kpiHint}>{kpis.delayedHint}</p>
          <img
            className={`${styles.kpiIcon} ${styles.kpiIconStatus}`}
            src="/dashboard/kpi-retrasadas.svg"
            alt=""
            width={48}
            height={48}
          />
        </article>
      </div>

      <div className={styles.toolbarRow}>
        <p className={styles.subtitle}>
          Proyectos ·{' '}
          <Link to="/dashboard/maestros">tipos de venta y documentos</Link>
          {' · '}
          <Link to="/maestros/task-pool">Base Datos Actividades</Link>
        </p>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando proyectos…</p>
      ) : obras.length === 0 ? (
        <p className={styles.empty}>
          No hay obras todavía. Crea la primera o ve a Configuración Global.
        </p>
      ) : (
        <div className={styles.projectGrid}>
          {obras.map((obra) => (
            <ObraCard
              key={obra.id}
              obra={obra}
              stages={stages}
              peopleOnSite={peopleByObra[obra.id] || 0}
              onOpen={(item) => navigate(`/dashboard/obras/${item.id}`)}
            />
          ))}
        </div>
      )}

      <PaginationBar
        page={page}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onChange={setPage}
      />

      <ObraFormModal
        open={formOpen}
        obra={null}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 3a7.5 7.5 0 1 1 4.7 13.4l4.2 4.2-1.4 1.4-4.2-4.2A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
      />
    </svg>
  )
}

