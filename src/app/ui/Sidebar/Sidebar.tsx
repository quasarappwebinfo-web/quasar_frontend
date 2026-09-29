import { NavLink } from 'react-router-dom'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { NAV_ICON_URLS, CHEVRON_ICON_URL } from '@/app/ui/Sidebar/iconUrls'
import {
  getUserDisplayName,
  getUserInitials,
  getUserRole,
  getVisibleNav,
  type SidebarItemId,
} from '@/app/ui/Sidebar/nav'
import { useAuth } from '@/auth'
import quasarLogo from '@/shared/assets/quasar-logo.png'
import { cn } from '@/shared/lib/cn'
import styles from './Sidebar.module.css'

type SidebarProps = {
  activeId?: SidebarItemId
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({
  activeId = 'dashboard',
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const { user, logout, offlineSession } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = getUserInitials(user)
  const displayName = getUserDisplayName(user)
  const role = offlineSession
    ? `${getUserRole(user)} · sin red`
    : getUserRole(user)
  const navItems = getVisibleNav(user)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  return (
    <>
      <button
        type="button"
        className={cn(styles.backdrop, mobileOpen && styles.backdropVisible)}
        aria-label="Cerrar menú"
        onClick={onMobileClose}
      />

      <aside
        className={cn(styles.sidebar, mobileOpen && styles.sidebarOpen)}
        aria-label="Navegación principal"
      >
        <div className={styles.brand}>
          <img
            className={styles.logo}
            src={quasarLogo}
            alt="Quasar — Arquitectura, diseño y construcción"
            width={150}
            height={91}
          />
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const active = item.id === activeId
            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={cn(styles.navItem, active && styles.navItemActive)}
                onClick={() => onMobileClose?.()}
              >
                <span
                  className={styles.navIcon}
                  style={
                    {
                      maskImage: `url(${NAV_ICON_URLS[item.id]})`,
                      WebkitMaskImage: `url(${NAV_ICON_URLS[item.id]})`,
                    } as CSSProperties
                  }
                  aria-hidden="true"
                />
                <span className={styles.navLabel}>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className={styles.footer} ref={menuRef}>
          <div className={styles.divider} />
          <button
            type="button"
            className={styles.userButton}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={styles.avatar} aria-hidden="true">
              {initials}
            </span>
            <span className={styles.userMeta}>
              <span className={styles.userName}>{displayName}</span>
              <span className={styles.userRole}>{role}</span>
            </span>
            <span
              className={cn(styles.chevron, menuOpen && styles.chevronOpen)}
              style={
                {
                  maskImage: `url(${CHEVRON_ICON_URL})`,
                  WebkitMaskImage: `url(${CHEVRON_ICON_URL})`,
                } as CSSProperties
              }
              aria-hidden="true"
            />
          </button>

          {menuOpen ? (
            <div className={styles.userMenu} role="menu">
              <button
                type="button"
                role="menuitem"
                className={styles.userMenuItem}
                onClick={() => {
                  setMenuOpen(false)
                  void logout()
                }}
              >
                Salir
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
