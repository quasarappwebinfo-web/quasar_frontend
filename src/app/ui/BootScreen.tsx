import quasarLogo from '@/shared/assets/quasar-logo.png'
import styles from './BootScreen.module.css'

export function BootScreen() {
  return (
    <main className={styles.page} aria-busy="true" aria-live="polite">
      <div className={styles.atmosphere} aria-hidden="true" />
      <img className={styles.logo} src={quasarLogo} alt="Quasar" />
    </main>
  )
}
