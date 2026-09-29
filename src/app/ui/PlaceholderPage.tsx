import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import styles from './PlaceholderPage.module.css'

type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  useDocumentTitle(`Quasar · ${title}`)

  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>{title}</p>
      <h1 className={styles.headline}>{title}</h1>
      <p className={styles.description}>{description}</p>
    </div>
  )
}
