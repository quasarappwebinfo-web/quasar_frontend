import { Button } from '@/shared/ui/Button'
import styles from './Pagination.module.css'

type PaginationBarProps = {
  page: number
  totalItems: number
  itemsPerPage: number
  onChange: (page: number) => void
}

export function PaginationBar({
  page,
  totalItems,
  itemsPerPage,
  onChange,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))

  if (totalItems <= itemsPerPage) {
    return (
      <p className={styles.meta}>
        {totalItems} resultado{totalItems === 1 ? '' : 's'}
      </p>
    )
  }

  return (
    <div className={styles.bar}>
      <p className={styles.meta}>
        Página {page} de {totalPages} · {totalItems} resultados
      </p>
      <div className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}
