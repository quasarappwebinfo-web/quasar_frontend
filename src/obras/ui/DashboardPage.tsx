import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listObras } from '@/obras/api/obrasApi'
import { isObraActiveWork, isObraDelayed } from '@/obras/lib/obraUi'
import type { Obra } from '@/obras/model/types'
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
import { Alert } from '@/shared/ui'
import { CatalogPager } from '@/task-pool/ui/CatalogParts'
import look from '@/task-pool/ui/taskPool.module.css'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  useDocumentTitle('Quasar · Inicio')

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useState(1)
  const [obras, setObras] = useState<Obra[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
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
      const [obrasData, assignmentsData] = await Promise.all([
        listObras({
          page,
          search: debouncedSearch,
          activeOnly: true,
        }),
        listAssignments({ page: 1, currentOnly: true }),
      ])
      setObras(obrasData.obras)
      setTotalItems(obrasData.pagination.totalItems)
      setItemsPerPage(obrasData.pagination.itemsPerPage)

      const counts: Record<number, number> = {}
      for (const assignment of assignmentsData.assignments) {
        counts[assignment.obraId] = (counts[assignment.obraId] || 0) + 1
      }
      setPeopleByObra(counts)
      setPeopleTotal(assignmentsData.pagination.totalItems)
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
    const listedHere = obras.length < totalItems
    return {
      activeCount: totalItems,
      peopleTotal,
      onTime,
      delayed: delayed.length,
      onTimeHint: listedHere ? 'En esta página' : 'Dentro del plazo estimado',
      delayedHint: listedHere
        ? 'En esta página'
        : delayed.length === 0
          ? 'Ninguna pasó su fecha de fin'
          : 'Pasó la fecha de fin',
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
    <div className={`${look.catalog} ${styles.page}`}>
      <header className={look.hero}>
        <div className={look.heroRow}>
          <div>
            <h1 className={look.catalogTitle}>Inicio</h1>
            <p className={look.catalogLead}>
              Obras activas, su cumplimiento y el personal asignado.
            </p>
          </div>
          <div className={look.heroTools}>
            <label className={look.searchBox}>
              <SearchGlyph />
              <input
                type="search"
                placeholder="Buscar obra o ciudad..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                aria-label="Buscar obras"
              />
            </label>
            {hasPermission('obras') ? (
              <button type="button" className={look.primaryBtn} onClick={() => setFormOpen(true)}>
                + Nueva obra
              </button>
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
              <button type="button" className={look.quietBtn} onClick={() => void markAllSeen()}>
                Marcar todas como vistas
              </button>
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
                    <button
                      type="button"
                      className={look.primaryBtn}
                      onClick={() => {
                        void markSeen(notice)
                        navigate(notice.link as string)
                      }}
                    >
                      Abrir actividad
                    </button>
                  ) : null}
                  <button type="button" className={look.quietBtn} onClick={() => void markSeen(notice)}>
                    Marcar como vista
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={look.stats} aria-label="Resumen">
        <article className={look.stat}>
          <span className={look.statIcon} style={{ background: '#e8f1ff', color: '#1d4ed8' }}>
            <HouseGlyph />
          </span>
          <div>
            <p className={look.statValue}>{kpis.activeCount}</p>
            <p className={look.statLabel}>Obras activas</p>
          </div>
        </article>
        <article className={look.stat}>
          <span className={look.statIcon} style={{ background: '#fff6e8', color: '#c2410c' }}>
            <PeopleGlyph />
          </span>
          <div>
            <p className={look.statValue}>{kpis.peopleTotal}</p>
            <p className={look.statLabel}>Personal asignado</p>
          </div>
        </article>
        <article className={look.stat}>
          <span className={look.statIcon} style={{ background: '#e8f7ee', color: '#15803d' }}>
            <CheckGlyph />
          </span>
          <div>
            <p className={look.statValue}>{kpis.onTime}</p>
            <p className={look.statLabel}>A tiempo</p>
            <p className={styles.statHint}>{kpis.onTimeHint}</p>
          </div>
        </article>
        <article className={look.stat}>
          <span className={look.statIcon} style={{ background: '#fdecec', color: '#b42318' }}>
            <ClockGlyph />
          </span>
          <div>
            <p className={look.statValue}>{kpis.delayed}</p>
            <p className={look.statLabel}>Con retraso</p>
            <p className={styles.statHint}>{kpis.delayedHint}</p>
          </div>
        </article>
      </section>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando proyectos…</p>
      ) : obras.length === 0 ? (
        <p className={styles.empty}>
          {debouncedSearch.trim()
            ? 'Ninguna obra coincide con la búsqueda.'
            : 'No hay obras todavía. Crea la primera.'}
        </p>
      ) : (
        <div className={styles.projectGrid}>
          {obras.map((obra) => (
            <ObraCard
              key={obra.id}
              obra={obra}
              peopleOnSite={peopleByObra[obra.id] || 0}
              onOpen={(item) => navigate(`/dashboard/obras/${item.id}`)}
            />
          ))}
        </div>
      )}

      <CatalogPager
        page={page}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        noun="obras"
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

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 3a7.5 7.5 0 1 1 4.7 13.4l4.2 4.2-1.4 1.4-4.2-4.2A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
      />
    </svg>
  )
}

function HouseGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 4 3 11h2v8h5v-5h4v5h5v-8h2L12 4Z" />
    </svg>
  )
}

function PeopleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 .5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 18.5c0-2.4 2.4-4 5-4s5 1.6 5 4V20H3v-1.5Zm10 .2c.2-1.5 1.4-2.8 3.2-3.2.5-.1 1-.2 1.4-.2 2 0 3.4 1.2 3.4 3V20h-8v-1.3Z"
      />
    </svg>
  )
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1.1 10.2-2.3-2.3-1.2 1.2 3.5 3.5 6.2-6.2-1.2-1.2-5 5Z"
      />
    </svg>
  )
}

function ClockGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm1 4h-2v5l4 2.4.9-1.6-2.9-1.7V8Z"
      />
    </svg>
  )
}

