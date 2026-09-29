import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/ui/useAuth'
import quasarLogo from '@/shared/assets/quasar-logo.png'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { Button } from '@/shared/ui'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useDocumentTitle('Quasar · Entrar')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
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
          <h1 className={styles.title}>Acceso</h1>
        </header>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span>Usuario</span>
            <input
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={submitting}
            />
          </label>

          <label className={styles.field}>
            <span>Contraseña</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            disabled={submitting || !username || !password}
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </main>
  )
}
