import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { NAV_ICON_URLS, CHEVRON_ICON_URL } from '@/app/ui/Sidebar/iconUrls'
import {
  getUserDisplayName,
  getUserInitials,
  getUserRole,
  getVisibleNav,
  type SidebarItemId,
} from '@/app/ui/Sidebar/nav'
import {
  listMyNotifications,
  markNotificationRead,
  NOTIFICATIONS_CHANGED,
  notifyNotificationsChanged,
  type UserNotification,
} from '@/app/ui/Sidebar/notificationsApi'
import { useAuth } from '@/auth'
import { changeMyPassword } from '@/identidad/api/usersApi'
import { Alert, Button, Field, Modal, TextInput } from '@/shared/ui'
import quasarLogo from '@/shared/assets/quasar-logo.png'
import { cn } from '@/shared/lib/cn'
import styles from './Sidebar.module.css'

function iconMask(url: string): CSSProperties {
  const value = `url("${url}")`
  return {
    maskImage: value,
    WebkitMaskImage: value,
    maskMode: 'alpha',
  }
}

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
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)
  const [notices, setNotices] = useState<UserNotification[]>([])
  const [unread, setUnread] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = getUserInitials(user)
  const displayName = getUserDisplayName(user)
  const role = offlineSession
    ? `${getUserRole(user)} · sin red`
    : getUserRole(user)
  const navItems = getVisibleNav(user)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    function loadNotices() {
      void listMyNotifications()
        .then((data) => {
          if (cancelled) return
          setNotices(data.notifications)
          setUnread(data.unread)
        })
        .catch(() => {
          if (cancelled) return
          setNotices([])
          setUnread(0)
        })
    }

    loadNotices()
    window.addEventListener(NOTIFICATIONS_CHANGED, loadNotices)
    return () => {
      cancelled = true
      window.removeEventListener(NOTIFICATIONS_CHANGED, loadNotices)
    }
  }, [user, menuOpen])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  async function submitMyPassword() {
    setPasswordError(null)
    if (!currentPassword || newPassword.length < 8) {
      setPasswordError('La contraseña nueva debe tener al menos 8 caracteres.')
      return
    }
    setSavingPassword(true)
    try {
      await changeMyPassword({ currentPassword, newPassword })
      setPasswordOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      await logout()
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'No se pudo cambiar')
    } finally {
      setSavingPassword(false)
    }
  }

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
                <span className={styles.navIconWrap} aria-hidden="true">
                  <span
                    className={styles.navIcon}
                    style={iconMask(NAV_ICON_URLS[item.id])}
                  />
                </span>
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
              {unread > 0 ? (
                <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>
              ) : null}
            </span>
            <span className={styles.userMeta}>
              <span className={styles.userName}>{displayName}</span>
              <span className={styles.userRole}>{role}</span>
            </span>
            <span
              className={cn(styles.chevron, menuOpen && styles.chevronOpen)}
              style={iconMask(CHEVRON_ICON_URL)}
              aria-hidden="true"
            />
          </button>

          {menuOpen ? (
            <div className={styles.userMenu} role="menu">
              {notices.some((notice) => !notice.readAt) ? (
                <div className={styles.noticeList}>
                  {notices
                    .filter((notice) => !notice.readAt)
                    .slice(0, 5)
                    .map((notice) => (
                    <button
                      key={notice.id}
                      type="button"
                      role="menuitem"
                      className={styles.noticeItem}
                      onClick={() => {
                        setMenuOpen(false)
                        if (!notice.readAt) {
                          setUnread((count) => Math.max(0, count - 1))
                          setNotices((items) =>
                            items.filter((item) => item.id !== notice.id),
                          )
                        }
                        void markNotificationRead(notice.id)
                          .then(() => notifyNotificationsChanged())
                          .catch(() => undefined)
                        if (notice.link) navigate(notice.link)
                      }}
                    >
                      <span className={styles.noticeTitle}>{notice.title}</span>
                      <span className={styles.noticeBody}>{notice.body}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className={styles.userMenuItem}
                onClick={() => {
                  setMenuOpen(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setPasswordError(null)
                  setPasswordOpen(true)
                }}
              >
                Mi contraseña
              </button>
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
      <Modal
        title="Cambiar mi contraseña"
        open={passwordOpen}
        onClose={() => {
          if (!savingPassword) setPasswordOpen(false)
        }}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPasswordOpen(false)} disabled={savingPassword}>
              Cancelar
            </Button>
            <Button disabled={savingPassword} onClick={() => void submitMyPassword()}>
              {savingPassword ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <Field label="Contraseña actual">
          <TextInput
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="Nueva contraseña" help="Mínimo 8 caracteres. Al guardar se cierra la sesión.">
          <TextInput
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {passwordError ? <Alert tone="error">{passwordError}</Alert> : null}
      </Modal>
    </>
  )
}
