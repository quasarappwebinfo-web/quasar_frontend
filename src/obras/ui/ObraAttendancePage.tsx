import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  downloadAttendanceReport,
  listObraAttendance,
} from '@/obras/api/asistenciaApi'
import {
  formatAttendanceTime,
  formatColombiaDate,
  todayColombiaIso,
} from '@/obras/lib/asistenciaUi'
import type { ObraDailyAttendance } from '@/obras/model/asistenciaTypes'
import { getObra } from '@/obras/api/obrasApi'
import { AsistenciaModal } from '@/obras/ui/AsistenciaModal'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { Alert, Button, Modal, useToast } from '@/shared/ui'
import styles from './ObraAttendance.module.css'

type WeekPoint = {
  date: string
  label: string
  count: number
}

export function ObraAttendancePage() {
  const { obraId } = useParams()
  const id = Number(obraId)
  const navigate = useNavigate()
  const toast = useToast()
  const [obraName, setObraName] = useState('')
  const [day, setDay] = useState(todayColombiaIso)
  const [rows, setRows] = useState<ObraDailyAttendance[]>([])
  const [week, setWeek] = useState<WeekPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')
  const [reportError, setReportError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useDocumentTitle(
    obraName ? `Quasar · ${obraName} · Asistencia` : 'Quasar · Asistencia',
  )

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setError('Obra inválida')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const days = weekEnding(day)
    try {
      const [obra, selected, ...rest] = await Promise.all([
        getObra(id),
        listObraAttendance({ obraId: id, date: day, currentOnly: true }),
        ...days.map((date) =>
          listObraAttendance({ obraId: id, date, currentOnly: true }).catch(() => ({
            attendance: [],
            pagination: { totalItems: 0, itemsPerPage: 0, currentPage: 1 },
          })),
        ),
      ])
      setObraName(obra.name)
      setRows(selected.attendance)
      setWeek(
        days.map((date, index) => ({
          date,
          label: weekdayLabel(date),
          count: rest[index]?.pagination.totalItems ?? rest[index]?.attendance.length ?? 0,
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la asistencia')
    } finally {
      setLoading(false)
    }
  }, [day, id])

  useEffect(() => {
    void load()
  }, [load])

  const count = rows.length
  const peak = Math.max(1, ...week.map((point) => point.count))
  const weekStart = week[0]?.date

  function openReport() {
    setReportFrom(weekStart || shiftIso(day, -6))
    setReportTo(day)
    setReportError(null)
    setReportOpen(true)
  }

  async function downloadReport() {
    const message = reportRangeError(reportFrom, reportTo, todayColombiaIso())
    if (message) {
      setReportError(message)
      return
    }
    setDownloading(true)
    setReportError(null)
    try {
      await downloadAttendanceReport({
        obraId: id,
        dateFrom: reportFrom,
        dateTo: reportTo,
      })
      setReportOpen(false)
    } catch (err) {
      const text = err instanceof Error ? err.message : 'No se pudo descargar el informe'
      setReportError(text)
      toast.error(text)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={() => navigate(`/dashboard/obras/${id}`)}>
        ← Volver a la obra
      </button>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Asistencia de la obra</h1>
          <p className={styles.subtitle}>
            {obraName || 'Control de personal en obra'}
          </p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.dayFilter}>
            <span>Día</span>
            <input
              type="date"
              value={day}
              max={todayColombiaIso()}
              onChange={(event) => {
                if (event.target.value) setDay(event.target.value)
              }}
            />
          </label>
          <Button variant="ghost" disabled={downloading} onClick={openReport}>
            Descargar informe
          </Button>
        </div>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Registro de asistencia</h2>
              <p className={styles.panelHint}>{formatColombiaDate(day)}</p>
            </div>
            <Button onClick={() => setRegisterOpen(true)}>Registrar llegada</Button>
          </div>

          {loading ? (
            <p className={styles.muted}>Cargando…</p>
          ) : rows.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Aún no hay registros de asistencia</p>
              <p>Registra la primera llegada para este día.</p>
              <Button onClick={() => setRegisterOpen(true)}>Registrar llegada</Button>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Nombre</th>
                    <th>Cargo</th>
                    <th>Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatAttendanceTime(row.signedAt)}</td>
                      <td>
                        <strong>{row.workerName || `Trabajador #${row.workerId}`}</strong>
                        {row.documentNumber ? (
                          <span className={styles.meta}>{row.documentNumber}</span>
                        ) : null}
                      </td>
                      <td>{row.positionName || '—'}</td>
                      <td>{row.recordedByName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className={styles.side}>
          <section className={styles.countCard}>
            <p className={styles.count}>{peopleLabel(count)}</p>
            <p className={styles.countHint}>En sitio este día</p>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Última semana</h2>
            <p className={styles.panelHint}>Personas distintas con llegada cada día.</p>
            <div className={styles.chart} aria-label="Personas en sitio durante la última semana">
              {week.map((point) => (
                <div key={point.date} className={styles.barCol}>
                  <span className={styles.barValue}>{point.count}</span>
                  <span className={styles.barTrack}>
                    <span
                      className={styles.bar}
                      style={{ height: `${Math.max(point.count === 0 ? 0 : 8, (point.count / peak) * 100)}%` }}
                    />
                  </span>
                  <span className={point.date === day ? styles.barLabelOn : styles.barLabel}>
                    {point.label}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <Modal
        title="Descargar informe"
        open={reportOpen}
        onClose={() => {
          if (!downloading) setReportOpen(false)
        }}
        footer={
          <>
            <Button variant="ghost" disabled={downloading} onClick={() => setReportOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={downloading} onClick={() => void downloadReport()}>
              {downloading ? 'Descargando…' : 'Descargar'}
            </Button>
          </>
        }
      >
        <p className={styles.rangeNote}>
          Elige el periodo del informe de {obraName || 'esta obra'}.
        </p>
        <div className={styles.rangeForm}>
          <label className={styles.dayFilter}>
            <span>Desde</span>
            <input
              type="date"
              value={reportFrom}
              max={reportTo || todayColombiaIso()}
              onChange={(event) => {
                setReportFrom(event.target.value)
                setReportError(null)
              }}
            />
          </label>
          <label className={styles.dayFilter}>
            <span>Hasta</span>
            <input
              type="date"
              value={reportTo}
              min={reportFrom || undefined}
              max={todayColombiaIso()}
              onChange={(event) => {
                setReportTo(event.target.value)
                setReportError(null)
              }}
            />
          </label>
        </div>
        {reportError ? <p className={styles.rangeError}>{reportError}</p> : null}
      </Modal>

      <AsistenciaModal
        open={registerOpen}
        obraId={id}
        obraName={obraName || 'Obra'}
        workDate={day}
        excludeWorkerIds={rows.map((row) => row.workerId)}
        onClose={() => setRegisterOpen(false)}
        onChanged={() => void load()}
      />
    </div>
  )
}

function peopleLabel(count: number): string {
  return count === 1 ? '1 persona' : `${count} personas`
}

function reportRangeError(from: string, to: string, today: string): string | null {
  if (!from || !to) return 'Indica la fecha inicial y la final.'
  if (from > today || to > today) return 'El periodo no puede incluir días futuros.'
  if (to < from) return 'La fecha final no puede ser anterior a la inicial.'
  if (daysBetween(from, to) > 400) return 'El periodo no puede superar 400 días.'
  return null
}

function daysBetween(from: string, to: string): number {
  const start = isoToDate(from)
  const end = isoToDate(to)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

function isoToDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

function weekEnding(iso: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftIso(iso, index - 6))
}

function shiftIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  date.setDate(date.getDate() + days)
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`
}

function weekdayLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  return date
    .toLocaleDateString('es-CO', { weekday: 'short' })
    .replace('.', '')
    .slice(0, 3)
}
