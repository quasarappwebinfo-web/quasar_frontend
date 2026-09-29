import { useSync } from '@/sync/ui/useSync'
import styles from './SyncBanner.module.css'

function formatWhen(value: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return value
  }
}

export function SyncBanner() {
  const {
    online,
    syncing,
    pendingCount,
    conflicts,
    meta,
    lastError,
    runSync,
    dismissConflict,
  } = useSync()

  const show =
    !online ||
    syncing ||
    pendingCount > 0 ||
    conflicts.length > 0 ||
    Boolean(lastError)

  if (!show) return null

  const tone = !online
    ? styles.offline
    : lastError || conflicts.length > 0
      ? styles.warn
      : styles.info

  return (
    <div className={`${styles.banner} ${tone}`} role="status">
      <div className={styles.copy}>
        {!online ? (
          <strong>Sin conexión</strong>
        ) : syncing ? (
          <strong>Sincronizando…</strong>
        ) : lastError ? (
          <strong>Sync con error</strong>
        ) : conflicts.length > 0 ? (
          <strong>
            {conflicts.length} conflicto{conflicts.length === 1 ? '' : 's'}
          </strong>
        ) : (
          <strong>
            {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
          </strong>
        )}
        <span className={styles.detail}>
          {!online
            ? 'Los cambios se guardan en este dispositivo y se subirán al recuperar red.'
            : lastError
              ? lastError
              : conflicts.length > 0
                ? 'El servidor tenía cambios más recientes (LWW). Se aplicó la versión del servidor.'
                : pendingCount > 0
                  ? 'Hay operaciones en cola de outbox.'
                  : `Última sync: ${formatWhen(meta.lastSyncAt)}`}
        </span>
      </div>
      <div className={styles.actions}>
        {conflicts.slice(0, 3).map((c) => (
          <button
            key={c.uuid}
            type="button"
            className={styles.actionBtn}
            onClick={() => void dismissConflict(c.uuid)}
            title={c.message || 'Conflicto'}
          >
            OK conflicto
          </button>
        ))}
        {online ? (
          <button
            type="button"
            className={styles.actionBtn}
            disabled={syncing}
            onClick={() => void runSync()}
          >
            {syncing ? 'Sync…' : 'Sincronizar'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
