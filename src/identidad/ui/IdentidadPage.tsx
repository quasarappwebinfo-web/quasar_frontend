import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth'
import { listPersons } from '@/identidad/api/personasApi'
import { listRoles } from '@/identidad/api/rolesApi'
import { changeMyPassword, listUsers } from '@/identidad/api/usersApi'
import {
  CatalogChromeProvider,
  useCatalogChromeValue,
  useCatalogStatsTick,
} from '@/task-pool/ui/CatalogParts'
import look from '@/task-pool/ui/taskPool.module.css'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { Alert, Button, Field, Modal, TextInput, useToast } from '@/shared/ui'
import { cn } from '@/shared/lib/cn'

export function IdentidadPage() {
  return (
    <CatalogChromeProvider>
      <PersonalView />
    </CatalogChromeProvider>
  )
}

function PersonalView() {
  const toast = useToast()
  const navigate = useNavigate()
  const chrome = useCatalogChromeValue()
  const statsTick = useCatalogStatsTick()
  const [stats, setStats] = useState({ persons: 0, roles: 0, users: 0 })
  const { logout } = useAuth()
  const location = useLocation()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const sectionTitle =
    location.pathname.includes('/users')
      ? 'Usuarios'
      : location.pathname.includes('/roles')
        ? 'Roles'
        : 'Personas'

  useDocumentTitle(`Quasar · Personal · ${sectionTitle}`)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      listPersons({ page: 1 }),
      listRoles({ page: 1 }),
      listUsers({ page: 1 }),
    ])
      .then(([persons, roles, users]) => {
        if (cancelled) return
        setStats({
          persons: persons.pagination.totalItems,
          roles: roles.pagination.totalItems,
          users: users.pagination.totalItems,
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [statsTick])

  const cards = [
    { to: '/persons', label: 'Personas', value: stats.persons, end: true, color: '#1d4ed8', soft: '#e8f1ff' },
    { to: '/persons/roles', label: 'Roles', value: stats.roles, end: false, color: '#6d28d9', soft: '#f3e8ff' },
    { to: '/persons/users', label: 'Usuarios', value: stats.users, end: false, color: '#15803d', soft: '#e8f7ee' },
  ]

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
      toast.success('Contraseña actualizada. Vuelve a iniciar sesión.')
      await logout()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cambiar'
      setPasswordError(message)
      toast.error(message)
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className={look.catalog}>
      <header className={look.hero}>
        <button type="button" className={look.back} onClick={() => navigate('/dashboard')}>
          ← Inicio
        </button>
        <div className={look.heroRow}>
          <div>
            <h1 className={look.catalogTitle}>Personal</h1>
            <p className={look.catalogLead}>
              Personas, roles y accesos del sistema.
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
                <SearchGlyph />
              </label>
            ) : null}
            {chrome ? (
              <button type="button" className={look.primaryBtn} onClick={chrome.onAction}>
                + {chrome.actionLabel}
              </button>
            ) : null}
            <button type="button" className={look.quietBtn} onClick={() => setPasswordOpen(true)}>
              Mi contraseña
            </button>
          </div>
        </div>
      </header>

      <section className={look.stats3} aria-label="Resumen de personal">
        {cards.map((card) => (
          <NavLink
            key={card.to}
            to={card.to}
            end={card.end}
            className={({ isActive }) => cn(look.stat, isActive && look.statOn)}
          >
            <span className={look.statIcon} style={{ color: card.color, background: card.soft }}>
              <PeopleGlyph />
            </span>
            <span>
              <p className={look.statValue}>{card.value.toLocaleString('es-CO')}</p>
              <p className={look.statLabel}>{card.label}</p>
            </span>
          </NavLink>
        ))}
      </section>

      <Outlet />

      <Modal
        title="Cambiar mi contraseña"
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPasswordOpen(false)}>
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
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="Nueva contraseña">
          <TextInput
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {passwordError ? <Alert tone="error">{passwordError}</Alert> : null}
      </Modal>
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

function PeopleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 11a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm7.2-.4a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM3.5 19.5c0-2.8 2.4-4.5 5.5-4.5s5.5 1.7 5.5 4.5V21h-11v-1.5Zm11.2-.3c.2-1.6 1.3-3 3-3.4.3 0 .6-.1.8-.1h.3c1.8.1 3.2 1.2 3.2 3.2V21H14.7v-.8Z"
      />
    </svg>
  )
}
