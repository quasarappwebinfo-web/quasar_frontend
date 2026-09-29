import { useEffect, useState, type FormEvent } from 'react'
import { recommendFromVersion } from '@/task-pool/api/versionesApi'
import type { RecommendationResult } from '@/task-pool/model/types'
import {
  Alert,
  Button,
  Field,
  Modal,
  TextInput,
} from '@/shared/ui'
import styles from './taskPool.module.css'

type RecomendarModalProps = {
  open: boolean
  versionId: number
  unitLabel?: string | null
  baseQuantity?: string | number | null
  baseDurationDays?: string | number | null
  onClose: () => void
}

export function RecomendarModal({
  open,
  versionId,
  unitLabel,
  baseQuantity,
  baseDurationDays,
  onClose,
}: RecomendarModalProps) {
  const [obraQuantity, setObraQuantity] = useState('250')
  const [targetDays, setTargetDays] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RecommendationResult | null>(null)

  useEffect(() => {
    if (!open) return
    setResult(null)
    setError(null)
    setTargetDays('')
  }, [open])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const qty = Number(obraQuantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('La cantidad de obra debe ser mayor a 0.')
      return
    }
    const days = targetDays.trim() ? Number(targetDays) : undefined
    if (days !== undefined && (!Number.isFinite(days) || days <= 0)) {
      setError('Los días objetivo deben ser mayores a 0.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await recommendFromVersion(versionId, qty, days)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo recomendar')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setResult(null)
    setError(null)
    onClose()
  }

  const unitSuffix = unitLabel ? ` (${unitLabel})` : ''
  const resultUnit =
    result?.unitSymbol || result?.unitName
      ? [result.unitSymbol, result.unitName].filter(Boolean).join(' · ')
      : unitLabel

  return (
    <Modal
      title="Recomendar para obra"
      open={open}
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cerrar
          </Button>
          <Button type="submit" form="recommend-form" disabled={loading}>
            {loading ? 'Calculando…' : 'Calcular'}
          </Button>
        </>
      }
    >
      <form id="recommend-form" className={styles.formGrid} onSubmit={handleSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className={styles.noteBox}>
          Indica la cantidad de obra
          {unitSuffix ? ` en ${unitLabel}` : ''} y, si quieres, los días que te
          quieres gastar. El sistema sugiere duración y cargos (no aprueba ni
          asigna).
          {baseQuantity != null && baseDurationDays != null ? (
            <>
              {' '}
              Base de la versión: {baseQuantity}
              {unitSuffix} / {baseDurationDays} días.
            </>
          ) : null}
        </div>
        <Field
          label={unitLabel ? `Cantidad de obra (${unitLabel})` : 'Cantidad de obra'}
          help={
            unitLabel
              ? `Cantidad real del proyecto en ${unitLabel}. Factor = cantidad obra ÷ cantidad base.`
              : 'Cantidad real del proyecto (misma unidad que la versión). Define la unidad primaria en la pestaña Unidades.'
          }
        >
          <TextInput
            type="number"
            step="any"
            value={obraQuantity}
            onChange={(e) => setObraQuantity(e.target.value)}
            required
          />
        </Field>
        <Field
          label="Días que me quiero gastar"
          help="Opcional. Si lo dejas vacío, se calcula la duración a ritmo base. Si pones menos días, se sugiere más gente; si pones más, menos gente."
        >
          <TextInput
            type="number"
            step="any"
            min="0.01"
            value={targetDays}
            onChange={(e) => setTargetDays(e.target.value)}
            placeholder="Ej. 10"
          />
        </Field>

        {result ? (
          <div className={styles.listStack}>
            {resultUnit ? (
              <div className={styles.listItem}>
                <div className={styles.listItemBody}>
                  <p className={styles.listItemTitle}>Unidad de medida</p>
                  <p className={styles.listItemMeta}>{resultUnit}</p>
                </div>
              </div>
            ) : null}
            <div className={styles.listItem}>
              <div className={styles.listItemBody}>
                <p className={styles.listItemTitle}>Cantidad de obra</p>
                <p className={styles.listItemMeta}>
                  {result.obraQuantity}
                  {resultUnit ? ` ${result.unitSymbol || resultUnit}` : ''}
                </p>
              </div>
            </div>
            <div className={styles.listItem}>
              <div className={styles.listItemBody}>
                <p className={styles.listItemTitle}>Factor de cantidad</p>
                <p className={styles.listItemMeta}>{result.scaleFactor}</p>
              </div>
            </div>
            {result.crewScaleFactor != null ? (
              <div className={styles.listItem}>
                <div className={styles.listItemBody}>
                  <p className={styles.listItemTitle}>Intensidad (días)</p>
                  <p className={styles.listItemMeta}>
                    ×{result.crewScaleFactor}
                  </p>
                </div>
              </div>
            ) : null}
            <div className={styles.listItem}>
              <div className={styles.listItemBody}>
                <p className={styles.listItemTitle}>Duración recomendada</p>
                <p className={styles.listItemMeta}>
                  {result.recommendedDurationDays} días
                </p>
              </div>
            </div>
            {result.recommendedPositions.map((pos) => (
              <div
                key={`${pos.workerPositionId}-${pos.specialtyId ?? 'none'}`}
                className={styles.listItem}
              >
                <div className={styles.listItemBody}>
                  <p className={styles.listItemTitle}>
                    {pos.positionName || `Cargo #${pos.workerPositionId}`}
                    {pos.specialtyName ? ` · ${pos.specialtyName}` : ''}
                  </p>
                  <p className={styles.listItemMeta}>
                    Base {pos.baseQuantity} → recomendado{' '}
                    {pos.recommendedQuantity}
                    {Number(pos.isRequired) === 1 ? ' · requerido' : ''}
                  </p>
                </div>
              </div>
            ))}
            <p className={styles.readonlyHint}>{result.note}</p>
          </div>
        ) : null}
      </form>
    </Modal>
  )
}
