import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './Modal.module.css'

type ModalProps = {
  title: string
  description?: string
  open: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({
  title,
  description,
  open,
  onClose,
  children,
  footer,
  wide,
}: ModalProps) {
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={wide ? `${styles.dialog} ${styles.wide}` : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <span className={styles.mark} aria-hidden="true">
              <svg className={styles.markIcon} viewBox="0 0 24 24">
                <rect x="6" y="3.5" width="12" height="17" rx="2" />
                <path d="M9 8.5h6M9 12h6M9 15.5h4" />
              </svg>
            </span>
            <div className={styles.headingText}>
              <h2 className={styles.title}>{title}</h2>
              {description ? <p className={styles.description}>{description}</p> : null}
            </div>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <svg className={styles.closeIcon} viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.2 3.2 12.8 12.8M12.8 3.2 3.2 12.8" />
            </svg>
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
