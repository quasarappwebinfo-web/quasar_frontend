import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from '@/app/ui/Sidebar'
import { getSidebarIdFromPath } from '@/app/ui/Sidebar/nav'
import { SyncBanner } from '@/sync'
import styles from './AppShell.module.css'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const activeId = getSidebarIdFromPath(location.pathname)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className={styles.shell}>
      <Sidebar
        activeId={activeId}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={styles.mainColumn}>
        <header className={styles.mobileBar}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
          <p className={styles.mobileTitle}>Quasar</p>
        </header>

        <SyncBanner />

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  )
}
