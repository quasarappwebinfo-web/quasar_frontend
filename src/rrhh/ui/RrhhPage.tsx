import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { listPositions, listSpecialties } from '@/rrhh/api/catalogosRrhhApi'
import { listWorkers } from '@/rrhh/api/trabajadoresApi'
import {
  CatalogChromeProvider,
  useCatalogChromeValue,
  useCatalogStatsTick,
} from '@/task-pool/ui/CatalogParts'
import look from '@/task-pool/ui/taskPool.module.css'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { cn } from '@/shared/lib/cn'

function titleFromPath(pathname: string): string {
  if (pathname.includes('/cargos')) return 'Cargos'
  if (pathname.includes('/especialidades')) return 'Especialidades'
  return 'Trabajadores'
}

export function RrhhPage() {
  return (
    <CatalogChromeProvider>
      <RrhhView />
    </CatalogChromeProvider>
  )
}

function RrhhView() {
  const location = useLocation()
  const navigate = useNavigate()
  const chrome = useCatalogChromeValue()
  const statsTick = useCatalogStatsTick()
  const section = titleFromPath(location.pathname)
  const [stats, setStats] = useState({ positions: 0, specialties: 0, workers: 0 })
  useDocumentTitle(`Quasar · RRHH · ${section}`)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      listPositions({ page: 1 }),
      listSpecialties({ page: 1 }),
      listWorkers({ page: 1 }),
    ])
      .then(([positions, specialties, workers]) => {
        if (cancelled) return
        setStats({
          positions: positions.pagination.totalItems,
          specialties: specialties.pagination.totalItems,
          workers: workers.pagination.totalItems,
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [statsTick])

  const cards = [
    {
      to: '/rrhh/cargos',
      label: 'Cargos',
      value: stats.positions,
      color: '#1d4ed8',
      soft: '#e8f1ff',
    },
    {
      to: '/rrhh/especialidades',
      label: 'Especialidades',
      value: stats.specialties,
      color: '#c2410c',
      soft: '#fff1e8',
    },
    {
      to: '/rrhh/trabajadores',
      label: 'Trabajadores',
      value: stats.workers,
      color: '#15803d',
      soft: '#e8f7ee',
    },
  ]

  return (
    <div className={look.catalog}>
      <header className={look.hero}>
        <button type="button" className={look.back} onClick={() => navigate('/dashboard')}>
          ← Inicio
        </button>
        <div className={look.heroRow}>
          <div>
            <h1 className={look.catalogTitle}>RRHH</h1>
            <p className={look.catalogLead}>
              Cargos, especialidades y trabajadores. El valor día y la cuenta se usan en la liquidación.
            </p>
          </div>
          <div className={look.heroTools}>
            {chrome ? (
              <label className={look.searchBox}>
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
              <button type="button" className={look.primaryBtn} onClick={chrome.onAction}>
                + {chrome.actionLabel}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <section className={look.stats3} aria-label="Resumen de RRHH">
        {cards.map((card) => (
          <NavLink
            key={card.to}
            to={card.to}
            className={({ isActive }) => cn(look.stat, isActive && look.statOn)}
          >
            <span className={look.statIcon} style={{ color: card.color, background: card.soft }}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8v-1.2C5 16.1 8 14.5 12 14.5s7 1.6 7 4.3V20H5Z"
                />
              </svg>
            </span>
            <span>
              <p className={look.statValue}>{card.value.toLocaleString('es-CO')}</p>
              <p className={look.statLabel}>{card.label}</p>
            </span>
          </NavLink>
        ))}
      </section>

      <Outlet />
    </div>
  )
}
