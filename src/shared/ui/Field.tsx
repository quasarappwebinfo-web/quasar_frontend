import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/shared/lib/cn'
import styles from './Field.module.css'

type FieldProps = {
  label: string
  htmlFor?: string
  hint?: string
  help?: string
  error?: string | null
  children: ReactNode
  className?: string
}

export function Field({
  label,
  htmlFor,
  hint,
  help,
  error,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn(styles.field, className)}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
        {help ? <FieldHelp text={help} /> : null}
      </div>
      {children}
      {hint && !error ? <span className={styles.hint}>{hint}</span> : null}
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  )
}

function FieldHelp({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const tipId = useId()

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span className={styles.helpRoot} ref={rootRef}>
      <button
        type="button"
        className={styles.helpBtn}
        aria-label="Ayuda del campo"
        aria-expanded={open}
        aria-controls={tipId}
        title="Qué hace este campo"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        ?
      </button>
      {open ? (
        <span id={tipId} role="tooltip" className={styles.helpTip}>
          {text}
        </span>
      ) : null}
    </span>
  )
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement>

export function TextInput({ className, ...props }: TextInputProps) {
  return <input className={cn(styles.control, className)} {...props} />
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function TextArea({ className, ...props }: TextAreaProps) {
  return <textarea className={cn(styles.control, styles.textarea, className)} {...props} />
}

type TextSelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function TextSelect({ className, children, ...props }: TextSelectProps) {
  return (
    <select className={cn(styles.control, className)} {...props}>
      {children}
    </select>
  )
}
