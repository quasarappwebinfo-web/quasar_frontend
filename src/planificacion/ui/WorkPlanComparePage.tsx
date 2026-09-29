import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { compareWorkPlan, getWorkPlan } from '@/planificacion/api/planesApi'
import { formatPlanDate, planStatusTone } from '@/planificacion/lib/planUi'
import type {
  WorkPlanCompare,
  WorkPlanVersion,
} from '@/planificacion/model/types'
import { WORK_PLAN_STATUS_LABELS } from '@/planificacion/model/types'
import { TASK_STATUS_LABELS } from '@/tareas/model/types'
import type { TaskStatus } from '@/tareas/model/types'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { Alert, Badge, Button } from '@/shared/ui'
import styles from './planificacion.module.css'

export function WorkPlanComparePage() {
  const { planId: planIdParam } = useParams()
  const planId = Number(planIdParam)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [compare, setCompare] = useState<WorkPlanCompare | null>(null)
  const [versions, setVersions] = useState<WorkPlanVersion[]>([])
  const [planName, setPlanName] = useState('')
  const [versionId, setVersionId] = useState(
    searchParams.get('versionId') || '',
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useDocumentTitle(
    planName ? `Quasar · Comparar · ${planName}` : 'Quasar · Comparar plan',
  )

  const load = useCallback(async () => {
    if (!Number.isFinite(planId)) {
      setError('Plan inválido')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const detail = await getWorkPlan(planId)
      setPlanName(detail.workPlan.name)
      setVersions(detail.versions)
      const selected =
        versionId ||
        (detail.workPlan.currentVersionId
          ? String(detail.workPlan.currentVersionId)
          : '')
      if (!versionId && selected) setVersionId(selected)
      const data = await compareWorkPlan(
        planId,
        selected ? Number(selected) : undefined,
      )
      setCompare(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo comparar')
      setCompare(null)
    } finally {
      setLoading(false)
    }
  }, [planId, versionId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const next = new URLSearchParams()
    if (versionId) next.set('versionId', versionId)
    setSearchParams(next, { replace: true })
  }, [versionId, setSearchParams])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate(`/dashboard/planes/${planId}`)}
          >
            ← Detalle del plan
          </button>
          <h1 className={styles.title}>Comparar planificado / real</h1>
          <p className={styles.subtitle}>
            {planName || `Plan #${planId}`} · lo firmado vs lo que pasó
          </p>
        </div>
        <div className={styles.actions}>
          <Button
            variant="ghost"
            onClick={() => navigate(`/dashboard/planes/${planId}`)}
          >
            Volver al plan
          </Button>
        </div>
      </header>

      {versions.length > 0 ? (
        <div className={styles.chipList}>
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`${styles.versionChip} ${
                String(v.id) === versionId ? styles.versionChipActive : ''
              }`}
              onClick={() => setVersionId(String(v.id))}
            >
              v{v.versionNumber}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Comparando…</p>
      ) : !compare ? (
        <p className={styles.empty}>Sin datos de comparación.</p>
      ) : (
        <>
          <div className={styles.metaRow}>
            <Badge tone={planStatusTone(compare.planStatus)}>
              {WORK_PLAN_STATUS_LABELS[compare.planStatus]}
            </Badge>
            <span className={styles.subtitle}>
              Versión {compare.versionNumber} · {compare.items.length} actividad(es)
            </span>
          </div>
          <section className={styles.panel}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Actividad (snapshot)</th>
                    <th>Planificado</th>
                    <th>Actual</th>
                    <th>Real / delays</th>
                    <th>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.items.map((item) => {
                    const hasDiff = Boolean(item.varianceNote)
                    return (
                      <tr
                        key={item.taskId}
                        className={hasDiff ? styles.compareDiff : undefined}
                      >
                        <td>
                          <strong>{item.taskNameSnapshot}</strong>
                          {item.currentName &&
                          item.currentName !== item.taskNameSnapshot ? (
                            <p className={styles.muted}>
                              Ahora: {item.currentName}
                            </p>
                          ) : null}
                        </td>
                        <td>
                          {formatPlanDate(item.plannedStartDate)} →{' '}
                          {formatPlanDate(item.plannedEndDate)}
                          <p className={styles.muted}>
                            Duración:{' '}
                            {item.approvedDurationDaysSnapshot ??
                              item.estimatedDurationDaysSnapshot ??
                              '—'}{' '}
                            d
                            {item.quantitySnapshot != null
                              ? ` · Qty ${item.quantitySnapshot}${
                                  item.unitSnapshot
                                    ? ` ${item.unitSnapshot}`
                                    : ''
                                }`
                              : ''}
                          </p>
                        </td>
                        <td>
                          {item.currentStatus
                            ? TASK_STATUS_LABELS[
                                item.currentStatus as TaskStatus
                              ] || item.currentStatus
                            : '—'}
                          <p className={styles.muted}>
                            Plan:{' '}
                            {formatPlanDate(item.currentPlannedStart)} →{' '}
                            {formatPlanDate(item.currentPlannedEnd)}
                          </p>
                          <p className={styles.muted}>
                            Real:{' '}
                            {formatPlanDate(item.currentActualStart)} →{' '}
                            {formatPlanDate(item.currentActualEnd)}
                          </p>
                        </td>
                        <td>
                          {item.daysLostTotal ?? 0} días perdidos
                          <p className={styles.muted}>
                            {item.delayCount} retraso(s)
                          </p>
                        </td>
                        <td>
                          {item.varianceNote ? (
                            <span className={styles.varNote}>
                              {item.varianceNote}
                            </span>
                          ) : (
                            <span className={styles.muted}>Sin variación</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
