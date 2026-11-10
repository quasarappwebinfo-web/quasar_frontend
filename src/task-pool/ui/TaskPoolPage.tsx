import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { listTaskBudgetActivities } from '@/task-pool/api/actividadesPresupuestalesApi'
import { listTaskChapters } from '@/task-pool/api/capitulosApi'
import { listTaskTemplates } from '@/task-pool/api/plantillasApi'
import { listTaskZones } from '@/task-pool/api/zonasApi'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { cn } from '@/shared/lib/cn'
import { Button, Modal } from '@/shared/ui'
import {
  CatalogChromeProvider,
  useCatalogChromeValue,
  useCatalogStatsTick,
} from './CatalogParts'
import styles from './taskPool.module.css'

const GUIDE_STEPS = [
  {
    title: 'Crea las unidades de medida',
    text: 'En la pestaña Unidades, crea las que uses (m², m³, und…). Luego podrás elegirlas en cada versión de Actividad Registrada.',
  },
  {
    title: 'Crea el capítulo',
    text: 'En Capítulos define el grupo de la obra y, si quieres, qué porcentaje aporta al avance. A partir de ahí se arman los subcapítulos y las actividades registradas.',
  },
  {
    title: 'Crea la Actividad Registrada',
    text: 'Ve a Actividades Registradas → «Nueva Actividad Registrada». Capítulo, subcapítulo y nombre son obligatorios. La zona es opcional.',
  },
  {
    title: 'Abre la Actividad Registrada y crea una versión',
    text: 'Entra a «Ver versiones» y pulsa «Nueva versión». Basta el nombre. Cantidad y duración son opcionales. Puedes clonar desde otra versión si ya tienes una lista.',
  },
  {
    title: 'Completa el detalle del borrador',
    text: 'Unidad, cargos, subactividades y dependencias son opcionales. Si agregas una fila, esa fila sí pide sus datos (por ejemplo, el cargo y la cantidad de personas).',
  },
  {
    title: 'Publica la versión',
    text: 'Pulsa «Publicar» aunque cantidad, duración y detalle estén vacíos. La versión queda inmutable. Para cambiarla, crea una nueva versión.',
  },
  {
    title: 'Prueba la recomendación (opcional)',
    text: 'En una versión publicada que tenga cantidad y duración base, usa «Recomendar». Verás duración y cargos sugeridos. Son solo recomendaciones: nadie aprueba aquí.',
  },
] as const

function titleFromPath(pathname: string): string {
  if (pathname.includes('/capitulos')) return 'Capítulos'
  if (pathname.includes('/zonas')) return 'Zonas'
  if (pathname.includes('/actividades-presupuestales')) {
    return 'Subcapítulos'
  }
  if (pathname.includes('/unidades')) return 'Unidades'
  return 'Actividades Registradas'
}

export function TaskPoolPage() {
  return (
    <CatalogChromeProvider>
      <CatalogView />
    </CatalogChromeProvider>
  )
}

function CatalogView() {
  const location = useLocation()
  const navigate = useNavigate()
  const chrome = useCatalogChromeValue()
  const statsTick = useCatalogStatsTick()
  const [helpOpen, setHelpOpen] = useState(false)
  const [stats, setStats] = useState({
    activities: 0,
    chapters: 0,
    subchapters: 0,
    zones: 0,
  })
  const section = titleFromPath(location.pathname)
  useDocumentTitle(`Quasar · Listado General de Actividades · ${section}`)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      listTaskTemplates({ page: 1 }),
      listTaskChapters({ page: 1 }),
      listTaskBudgetActivities({ page: 1 }),
      listTaskZones({ page: 1 }),
    ])
      .then(([activities, chapters, subchapters, zones]) => {
        if (cancelled) return
        setStats({
          activities: activities.pagination.totalItems,
          chapters: chapters.pagination.totalItems,
          subchapters: subchapters.pagination.totalItems,
          zones: zones.pagination.totalItems,
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [statsTick])

  const cards = [
    {
      to: '/maestros/task-pool/plantillas',
      label: 'Total de actividades',
      value: stats.activities,
      color: '#1d4ed8',
      soft: '#e8f1ff',
      kind: 'activities' as const,
    },
    {
      to: '/maestros/task-pool/capitulos',
      label: 'Capítulos',
      value: stats.chapters,
      color: '#1d4ed8',
      soft: '#e8f1ff',
      kind: 'chapters' as const,
    },
    {
      to: '/maestros/task-pool/actividades-presupuestales',
      label: 'Subcapítulos',
      value: stats.subchapters,
      color: '#c2410c',
      soft: '#fff1e8',
      kind: 'subs' as const,
    },
    {
      to: '/maestros/task-pool/zonas',
      label: 'Zonas',
      value: stats.zones,
      color: '#15803d',
      soft: '#e8f7ee',
      kind: 'zones' as const,
    },
  ]

  return (
    <div className={styles.catalog}>
      <header className={styles.hero}>
        <button type="button" className={styles.back} onClick={() => navigate('/dashboard')}>
          ← Inicio
        </button>
        <div className={styles.heroRow}>
          <div>
            <h1 className={styles.catalogTitle}>Listado General de Actividades</h1>
            <p className={styles.catalogLead}>
              Consulta el catálogo completo de actividades del sistema.
            </p>
          </div>
          <div className={styles.heroTools}>
            {chrome ? (
              <label className={styles.searchBox}>
                <input
                  type="search"
                  value={chrome.search}
                  placeholder={chrome.placeholder}
                  aria-label={chrome.placeholder}
                  onChange={(event) => chrome.onSearch(event.target.value)}
                />
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M10.5 3a7.5 7.5 0 1 1 4.7 13.4l4.2 4.2-1.4 1.4-4.2-4.2A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
                  />
                </svg>
              </label>
            ) : null}
            {chrome ? (
              <button type="button" className={styles.primaryBtn} onClick={chrome.onAction}>
                + {chrome.actionLabel}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.helpBtn}
              aria-label="Cómo crear una actividad"
              onClick={() => setHelpOpen(true)}
            >
              ?
            </button>
          </div>
        </div>
      </header>

      <section className={styles.stats} aria-label="Resumen del catálogo">
        {cards.map((card) => (
          <NavLink
            key={card.to}
            to={card.to}
            className={({ isActive }) => cn(styles.stat, isActive && styles.statOn)}
          >
            <span className={styles.statIcon} style={{ color: card.color, background: card.soft }}>
              <StatGlyph kind={card.kind} />
            </span>
            <span>
              <p className={styles.statValue}>{card.value.toLocaleString('es-CO')}</p>
              <p className={styles.statLabel}>{card.label}</p>
            </span>
          </NavLink>
        ))}
      </section>
      <NavLink
        to="/maestros/task-pool/unidades"
        className={({ isActive }) => cn(styles.sectionLink, isActive && styles.sectionLinkOn)}
      >
        Unidades de medida
      </NavLink>

      <Outlet />

      <Modal
        title="Cómo crear una actividad en la base"
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        wide
        footer={
          <Button onClick={() => setHelpOpen(false)}>Entendido</Button>
        }
      >
        <div className={styles.helpGuide}>
          <p className={styles.helpLead}>
            El listado no son las actividades de una obra: es el catálogo
            de Actividades Registradas reutilizables. Sigue estos pasos desde cero:
          </p>
          <ol className={styles.helpSteps}>
            {GUIDE_STEPS.map((step, index) => (
              <li key={step.title} className={styles.helpStep}>
                <span className={styles.helpStepNum}>{index + 1}</span>
                <div className={styles.helpStepBody}>
                  <p className={styles.helpStepTitle}>{step.title}</p>
                  <p className={styles.helpStepText}>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className={styles.helpNote}>
            Si más adelante quieres cambiar una versión ya publicada, no la
            edites: crea una <strong>nueva versión</strong> (puedes clonarla) y
            publica esa. La anterior se puede archivar.
          </p>
        </div>
      </Modal>
    </div>
  )
}

function StatGlyph({ kind }: { kind: 'activities' | 'chapters' | 'subs' | 'zones' }) {
  if (kind === 'chapters' || kind === 'subs') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 1.5V9h4.5L14 4.5ZM8 12h8v1.6H8V12Zm0 3.4h6V17H8v-1.6Z" />
      </svg>
    )
  }
  if (kind === 'zones') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M4 20V9l8-5 8 5v11h-5v-6H9v6H4Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M7 3h10a2 2 0 0 1 2 2v16l-7-3-7 3V5a2 2 0 0 1 2-2Z" />
    </svg>
  )
}
