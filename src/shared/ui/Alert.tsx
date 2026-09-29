import styles from './Alert.module.css'

type AlertProps = {
  tone?: 'info' | 'error' | 'success'
  children: string
}

export function Alert({ tone = 'info', children }: AlertProps) {
  return (
    <p className={`${styles.alert} ${styles[tone]}`} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </p>
  )
}
