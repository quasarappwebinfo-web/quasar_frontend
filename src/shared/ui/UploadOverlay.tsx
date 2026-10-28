import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import quasarLogo from '@/shared/assets/quasar-logo.png'
import styles from './UploadOverlay.module.css'

type UploadOverlayProps = {
  open: boolean
  label?: string
}

export function UploadOverlay({
  open,
  label = 'Cargando imagen…',
}: UploadOverlayProps) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className={styles.overlay} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.logoCard}>
        <img className={styles.logo} src={quasarLogo} alt="" />
      </div>
      <p className={styles.label}>{label}</p>
    </div>,
    document.body,
  )
}
