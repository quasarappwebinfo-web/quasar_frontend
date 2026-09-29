import type { Obra, StageOption } from '@/obras/model/types'
import {
  estimateObraProgress,
  formatObraLocation,
  isObraDelayed,
  isObraFinished,
  obraTimelineLabel,
  resolveObraCover,
} from '@/obras/lib/obraUi'
import styles from './DashboardPage.module.css'

type ObraCardProps = {
  obra: Obra
  stages: StageOption[]
  peopleOnSite?: number
  onOpen: (obra: Obra) => void
}

export function ObraCard({ obra, stages, peopleOnSite = 0, onOpen }: ObraCardProps) {
  const progress = estimateObraProgress(obra, stages)
  const timeline = obraTimelineLabel(obra)
  const finished = isObraFinished(obra)
  const delayed = isObraDelayed(obra)
  const coverSrc = resolveObraCover(obra)

  return (
    <button
      type="button"
      className={styles.obraCard}
      onClick={() => onOpen(obra)}
    >
      <div className={styles.cover}>
        <img className={styles.coverImg} src={coverSrc} alt="" />
        {finished ? (
          <div className={styles.finishedOverlay}>Proyecto terminado</div>
        ) : null}
      </div>

      <div className={styles.cardBody}>
        <div>
          <h3 className={styles.cardName}>{obra.name}</h3>
          <p className={styles.location}>
            <LocationPin className={styles.pin} />
            {formatObraLocation(obra)}
          </p>
        </div>

        <div className={styles.progressBlock}>
          <div className={styles.progressTop}>
            <span>{obra.currentStageName || 'Sin etapa'}</span>
            <span className={styles.progressPct}>{progress}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={`${styles.progressFill} ${
                finished
                  ? styles.progressFillDone
                  : delayed
                    ? styles.progressFillDelay
                    : ''
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className={styles.cardFooter}>
          <span className={styles.people}>
            <PeopleIcon />
            {peopleOnSite} en el sitio
          </span>
          <span className={styles.statusPill}>
            <span
              className={`${styles.dot} ${
                timeline.tone === 'ok'
                  ? styles.dotOk
                  : timeline.tone === 'delay'
                    ? styles.dotDelay
                    : timeline.tone === 'done'
                      ? styles.dotDone
                      : ''
              }`}
            />
            {timeline.label}
          </span>
        </div>
      </div>
    </button>
  )
}

function LocationPin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5A4.5 4.5 0 0 0 8 1.5Zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z"
      />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5.2 7.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Zm5.6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM1.8 13.2c0-2 2-3.2 3.4-3.2h.8c1.4 0 3.4 1.2 3.4 3.2v.5H1.8v-.5Zm7.2-.2c.3-1.1 1.2-2.1 2.5-2.4.4-.1.8-.2 1.1-.2h.4c1.2.1 2.2 1 2.2 2.4v.5H9v-.3Z"
      />
    </svg>
  )
}
