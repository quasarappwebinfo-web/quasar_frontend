import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { changeMyPassword } from '@/identidad/api/usersApi'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { Alert, Button, Field, Modal, TextInput, useToast } from '@/shared/ui'
import { cn } from '@/shared/lib/cn'
import styles from './identidad.module.css'

const TABS = [
  { to: '/persons', label: 'Personas', end: true },
  { to: '/persons/roles', label: 'Roles', end: false },
  { to: '/persons/users', label: 'Usuarios', end: false },
] as const

export function IdentidadPage() {
  const toast = useToast()
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

  useDocumentTitle(`Quasar · ${sectionTitle}`)

  async function submitMyPassword() {
    setPasswordError(null)
    setSavingPassword(true)
    try {
      await changeMyPassword({ currentPassword, newPassword })
      setPasswordOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      toast.success('Tu contraseña fue actualizada')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cambiar'
      setPasswordError(message)
      toast.error(message)
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Identidad</p>
          <h1 className={styles.title}>Personal</h1>
          <p className={styles.subtitle}>
            Personas, roles y accesos en un solo lugar.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setPasswordOpen(true)}>
          Mi contraseña
        </Button>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Secciones de identidad">
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
