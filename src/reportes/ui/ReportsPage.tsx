import { useEffect, useState, type FormEvent } from 'react'
import { listObras } from '@/obras/api/obrasApi'
import type { Obra } from '@/obras/model/types'
import { downloadLiquidacion } from '@/reportes/api/liquidacionApi'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { Alert, Button, Field, TextInput, TextSelect } from '@/shared/ui'
import styles from './ReportsPage.module.css'

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function ReportsPage() {
  useDocumentTitle('Quasar · Reportes')
  const today = new Date()
  const [dateFrom, setDateFrom] = useState(
    isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
  )
  const [dateTo, setDateTo] = useState(isoDate(today))
  const [obraId, setObraId] = useState('')
  const [obras, setObras] = useState<Obra[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const first = await listObras({ page: 1, activeOnly: true })
        const all = [...first.obras]
        const pages = Math.ceil(
          first.pagination.totalItems / first.pagination.itemsPerPage,
        )
        for (let page = 2; page <= pages && page <= 20; page += 1) {
          const next = await listObras({ page, activeOnly: true })
          all.push(...next.obras)
        }
        if (!cancelled) setObras(all)
      } catch {
        if (!cancelled) setObras([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleDownload(event: FormEvent) {
    event.preventDefault()
    if (!dateFrom || !dateTo) {
      setError('Elige el periodo.')
      return
    }
    if (dateTo < dateFrom) {
      setError('La fecha final no puede ser anterior a la inicial.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await downloadLiquidacion({
        dateFrom,
        dateTo,
        obraId: obraId ? Number(obraId) : undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <header>
        <p className={styles.eyebrow}>Operación</p>
        <h1 className={styles.title}>Reportes</h1>
        <p className={styles.subtitle}>
          La liquidación sale de la asistencia ya registrada. Cada día presente
          cuenta una vez, se multiplica por el valor día del trabajador y el
          Excel trae también en qué obra estuvo día a día.
        </p>
      </header>

      <form className={styles.card} onSubmit={(event) => void handleDownload(event)}>
        <div>
          <h2 className={styles.cardTitle}>Liquidación de asistencia</h2>
          <p className={styles.lead}>
            El valor día y la cuenta Nequi se toman de cada trabajador en RRHH.
            El archivo lleva el logo de Quasar, el resumen a pagar y la hoja
            día a día.
          </p>
        </div>
        <div className={styles.grid}>
          <Field label="Desde">
            <TextInput
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              required
            />
          </Field>
          <Field label="Hasta">
            <TextInput
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              required
            />
          </Field>
          <div className={styles.span}>
            <Field label="Obra" hint="Vacío incluye todas las obras del periodo.">
              <TextSelect value={obraId} onChange={(e) => setObraId(e.target.value)}>
                <option value="">Todas las obras</option>
                {obras.map((obra) => (
                  <option key={obra.id} value={obra.id}>
                    {obra.name}
                  </option>
                ))}
              </TextSelect>
            </Field>
          </div>
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className={styles.actions}>
          <Button type="submit" disabled={saving}>
            {saving ? 'Generando…' : 'Descargar Excel'}
          </Button>
        </div>
      </form>
    </div>
  )
}
