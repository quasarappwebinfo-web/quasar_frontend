import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getObra } from '@/obras/api/obrasApi'
import { listWorkPlans } from '@/planificacion/api/planesApi'
import {
  formatPlanDate,
  planStatusTone,
} from '@/planificacion/lib/planUi'
import type { WorkPlan, WorkPlanStatus } from '@/planificacion/model/types'
import { WORK_PLAN_STATUS_LABELS } from '@/planificacion/model/types'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import {
  Alert,
  Badge,
  Button,
  Field,
  PaginationBar,
  TextInput,
  TextSelect,
} from '@/shared/ui'
import { CreatePlanModal } from './CreatePlanModal'
import styles from './planificacion.module.css'

export function WorkPlansPage() {
  const { obraId: obraIdParam } = useParams()
  const obraId = Number(obraIdParam)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [obraName, setObraName] = useState('')
  const [plans, setPlans] = useState<WorkPlan[]>([])
  const [page, setPage] = useState(Number(searchParams.get('page') || 1))
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [status, setStatus] = useState<WorkPlanStatus | ''>(
    (searchParams.get('status') as WorkPlanStatus) || '',
  )
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(
    () => searchParams.get('nuevo') === '1',
  )

  useDocumentTitle(
    obraName ? `Quasar · ${obraName} · Planes` : 'Quasar · Planificación',
  )

  const load = useCallback(async () => {
    if (!Number.isFinite(obraId)) {
      setError('Obra inválida')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await listWorkPlans({
        page,
        obraId,
        status: status || undefined,
        search: search || undefined,
      })
      setPlans(data.workPlans)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar planes')
      setPlans([])
    } finally {
      setLoading(false)
    }
  }, [obraId, page, status, search])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void getObra(obraId)
      .then((obra) => setObraName(obra.name))
      .catch(() => setObraName(''))
  }, [obraId])

  useEffect(() => {
    const next = new URLSearchParams()
    if (page > 1) next.set('page', String(page))
    if (status) next.set('status', status)
    if (search) next.set('search', search)
    setSearchParams(next, { replace: true })
  }, [page, status, search, setSearchParams])

  useEffect(() => {
    if (searchParams.get('nuevo') === '1') {
      setCreateOpen(true)
    }
  }, [searchParams])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate(`/dashboard/obras/${obraId}`)}
          >
            ← Project View
          </button>
          <h1 className={styles.title}>Planificación</h1>
          <p className={styles.subtitle}>
            {obraName || `Obra #${obraId}`} · define un periodo y selecciona las
            actividades a ejecutar; luego fírmalo.
          </p>
        </div>
        <div className={styles.actions}>
          <Button onClick={() => setCreateOpen(true)}>+ Nuevo plan</Button>
        </div>
      </header>

      <div className={styles.filters}>
        <div className={styles.filterField}>
          <Field label="Estado">
            <TextSelect
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as WorkPlanStatus | '')
                setPage(1)
              }}
            >
              <option value="">Todos</option>
              {(Object.keys(WORK_PLAN_STATUS_LABELS) as WorkPlanStatus[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {WORK_PLAN_STATUS_LABELS[key]}
                  </option>
                ),
              )}
            </TextSelect>
          </Field>
        </div>
        <div className={styles.filterField}>
          <Field label="Buscar">
            <TextInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Nombre del plan…"
            />
          </Field>
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando planes…</p>
      ) : plans.length === 0 ? (
        <p className={styles.empty}>
          Aún no hay planes. Crea uno: primero el periodo, luego las actividades.
        </p>
      ) : (
        <div className={styles.list}>
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              className={styles.planCard}
              onClick={() => navigate(`/dashboard/planes/${plan.id}`)}
            >
              <div className={styles.planCardMain}>
                <p className={styles.planName}>{plan.name}</p>
                <p className={styles.planMeta}>
                  {formatPlanDate(plan.startDate)} → {formatPlanDate(plan.endDate)}
                  {plan.currentVersionNumber
                    ? ` · v${plan.currentVersionNumber}`
                    : ''}
                </p>
              </div>
              <Badge tone={planStatusTone(plan.status)}>
                {WORK_PLAN_STATUS_LABELS[plan.status]}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <PaginationBar
        page={page}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onChange={setPage}
      />

      <CreatePlanModal
        open={createOpen}
        obraId={obraId}
        obraName={obraName}
        onClose={() => setCreateOpen(false)}
        onCreated={(planId) => navigate(`/dashboard/planes/${planId}`)}
      />
    </div>
  )
}
