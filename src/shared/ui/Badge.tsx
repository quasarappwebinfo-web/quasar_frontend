import { cn } from '@/shared/lib/cn'
import styles from './Badge.module.css'

type BadgeProps = {
  tone?: 'neutral' | 'success' | 'danger'
  children: string
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={cn(styles.badge, styles[tone])}>{children}</span>
}
