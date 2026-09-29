import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { cn } from '@/shared/lib/cn'
import styles from './rrhh.module.css'

const TABS = [
  { to: '/rrhh/cargos', label: 'Cargos', end: true },
  { to: '/rrhh/especialidades', label: 'Especialidades', end: true },
  { to: '/rrhh/trabajadores', label: 'Trabajadores', end: true },
] as const

function titleFromPath(pathname: string): string {
  if (pathname.includes('/cargos')) return 'Cargos'
  if (pathname.includes('/especialidades')) return 'Especialidades'
  return 'Trabajadores'
}

export function RrhhPage() {
  const location = useLocation()
  const section = titleFromPath(location.pathname)
  useDocumentTitle(`Quasar · ${section}`)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Operación</p>
          <h1 className={styles.title}>RRHH</h1>
          <p className={styles.subtitle}>
            Cargos, especialidades y trabajadores. La asistencia diaria (quién
            llegó hoy) se registra desde cada obra, con firma.
          </p>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="RRHH">
        {TABS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            role="tab"
            className={({ isActive }) => cn(styles.tab, isActive && styles.tabActive)}
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}
