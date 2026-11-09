import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AuthRequestError,
  confirmPasswordRecovery,
  requestPasswordRecovery,
} from '@/auth/api/authApi'
import quasarLogo from '@/shared/assets/quasar-logo.png'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { Button } from '@/shared/ui'
import styles from './LoginPage.module.css'

const SENT_MESSAGE =
  'Si el usuario tiene correo, enviamos un código. Revisa la bandeja. Si no tienes correo, pídele a un super admin que restablezca la clave.'

export function RecoverAccessPage() {
  const [step, setStep] = useState<'ask' | 'confirm' | 'done'>('ask')
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useDocumentTitle('Quasar · Recuperar acceso')

  async function askCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      await requestPasswordRecovery(identifier.trim())
      setNotice(SENT_MESSAGE)
      setStep('confirm')
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const digits = code.trim()
    if (!/^\d{6}$/.test(digits)) {
      setError('El código son 6 dígitos.')
      return
    }
    if (newPassword.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres.')
      return
    }
    setSubmitting(true)
    try {
      await confirmPasswordRecovery({
        identifier: identifier.trim(),
        code: digits,
        newPassword,
      })
      setStep('done')
    } catch (err) {
      setError(messageFor(err, 'El código no es válido o ya venció.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <div className={styles.stage}>
        <header className={styles.intro}>
          <img
            className={styles.logo}
            src={quasarLogo}
            alt="Quasar — Arquitectura, diseño y construcción"
          />
          <h1 className={styles.title}>Recuperar acceso</h1>
        </header>

        {step === 'done' ? (
          <div className={styles.form}>
            <p className={styles.notice}>Contraseña actualizada.</p>
            <Link className={styles.textLink} to="/login">
              Ir al inicio de sesión
            </Link>
          </div>
        ) : step === 'ask' ? (
          <form className={styles.form} onSubmit={askCode} noValidate>
            <p className={styles.hint}>
              Escribe tu usuario o tu correo. Hace falta conexión. El código
              dura 15 minutos.
            </p>
            <label className={styles.field}>
              <span>Usuario o correo</span>
              <input
                name="identifier"
                autoComplete="username"
                autoFocus
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
                disabled={submitting}
              />
            </label>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className={styles.submit}
              disabled={submitting || !identifier.trim()}
            >
              {submitting ? 'Enviando…' : 'Enviar código'}
            </Button>
            <Link className={styles.textLink} to="/login">
              Volver al inicio de sesión
            </Link>
          </form>
        ) : (
          <form className={styles.form} onSubmit={confirm} noValidate>
            {notice ? <p className={styles.notice}>{notice}</p> : null}
            <label className={styles.field}>
              <span>Código</span>
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                disabled={submitting}
              />
            </label>
            <label className={styles.field}>
              <span>Contraseña nueva</span>
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={8}
                disabled={submitting}
              />
            </label>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className={styles.submit} disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => {
                setStep('ask')
                setCode('')
                setNewPassword('')
                setError(null)
              }}
            >
              Pedir otro código
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

function messageFor(err: unknown, fallback = 'No se pudo completar la solicitud.'): string {
  if (err instanceof AuthRequestError) {
    if (err.status === 429) return 'Demasiados intentos. Espera un minuto.'
    if (err.status === 503) return err.message
    if (err.status === 400) return 'El código no es válido o ya venció.'
    return err.message || fallback
  }
  return err instanceof Error ? err.message : fallback
}
