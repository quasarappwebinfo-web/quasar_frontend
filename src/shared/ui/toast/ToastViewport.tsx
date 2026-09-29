import { useToast } from './useToast'
import styles from './ToastViewport.module.css'

export function ToastViewport() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className={styles.viewport} aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.tone]}`}
          role={toast.tone === 'error' ? 'alert' : 'status'}
        >
          <span className={styles.dot} aria-hidden="true" />
          <p className={styles.message}>{toast.message}</p>
          <button
            type="button"
            className={styles.close}
            aria-label="Cerrar aviso"
            onClick={() => dismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
