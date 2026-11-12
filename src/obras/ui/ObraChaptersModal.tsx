import { useEffect, useState } from 'react'
import {
  listObraChapterMarks,
  saveObraChapterMarks,
  type ObraChapterMark,
} from '@/obras/api/obrasApi'
import { ApiError } from '@/shared/api/apiJson'
import {
  Alert,
  Button,
  Field,
  Modal,
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
import styles from './DashboardPage.module.css'

type MarkMode = 'open' | 'running' | 'completed'

type ZoneRow = {
  zoneId: number
  zoneName: string
  mode: MarkMode
  percent: string
}

type ChapterRow = {
  chapterId: number
  name: string
  zones: ZoneRow[]
}

type ObraChaptersModalProps = {
  open: boolean
  obraId: number
  onClose: () => void
  onSaved: () => void
}

function rowsFromMarks(marks: ObraChapterMark[]): ChapterRow[] {
  return marks.map((mark) => ({
    chapterId: mark.chapterId,
    name: mark.chapterName,
    zones: mark.zones.map((zone) => ({
      zoneId: zone.zoneId,
      zoneName: zone.zoneName,
      mode: zone.mode,
      percent:
        zone.mode === 'running' && zone.progressPercent
          ? String(zone.progressPercent)
          : '',
    })),
  }))
}

export function ObraChaptersModal({
  open,
  obraId,
  onClose,
  onSaved,
}: ObraChaptersModalProps) {
  const toast = useToast()
  const [rows, setRows] = useState<ChapterRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void listObraChapterMarks(obraId)
      .then((marks) => {
        if (cancelled) return
        setRows(rowsFromMarks(marks))
      })
      .catch((err) => {
        if (cancelled) return
        setRows([])
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los capítulos')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, obraId])

  function updateZone(chapterId: number, zoneId: number, patch: Partial<ZoneRow>) {
    setRows((current) =>
      current.map((row) =>
        row.chapterId === chapterId
          ? {
              ...row,
              zones: row.zones.map((zone) =>
                zone.zoneId === zoneId ? { ...zone, ...patch } : zone,
              ),
            }
          : row,
      ),
    )
  }

  async function handleSave() {
    const chapters: Array<{
      chapterId: number
      zoneId: number
      mode: MarkMode
      progressPercent?: number
    }> = []
    for (const row of rows) {
      for (const zone of row.zones) {
        if (zone.mode === 'running' && zone.percent.trim()) {
          const percent = Number(zone.percent)
          if (!Number.isInteger(percent) || percent < 1 || percent > 99) {
            setError(
              `«${row.name}» en ${zone.zoneName} necesita un avance entre 1 y 99, o déjalo vacío.`,
            )
            return
          }
          chapters.push({
            chapterId: row.chapterId,
            zoneId: zone.zoneId,
            mode: 'running',
            progressPercent: percent,
          })
          continue
        }
        chapters.push({
          chapterId: row.chapterId,
          zoneId: zone.zoneId,
          mode: zone.mode,
        })
      }
    }
    setSaving(true)
    setError(null)
    try {
      await saveObraChapterMarks(obraId, chapters)
      toast.success('Capítulos actualizados')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Capítulos de la obra"
      open={open}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || loading || rows.length === 0}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className={styles.markList}>
        <p className={styles.markNote}>
          Cada zona se marca aparte. Completado deja esa zona en 100 % y ya no
          admite actividades nuevas ahí. Las otras zonas del mismo capítulo
          siguen abiertas.
        </p>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {loading ? <p className={styles.markNote}>Cargando capítulos…</p> : null}
        {!loading && rows.length === 0 && !error ? (
          <p className={styles.markNote}>No hay capítulos activos.</p>
        ) : null}
        {rows.map((row) => (
          <section key={row.chapterId} className={styles.markChapter}>
            <h3 className={styles.markChapterTitle}>{row.name}</h3>
            {row.zones.length === 0 ? (
              <p className={styles.markNote}>No hay zonas activas.</p>
            ) : (
              <div className={styles.markZones}>
                {row.zones.map((zone) => (
                  <div key={zone.zoneId} className={styles.markZone}>
                    <Field
                      label={zone.zoneName}
                      hint={
                        zone.mode === 'completed'
                          ? 'Queda en 100 %. No admite actividades nuevas.'
                          : undefined
                      }
                    >
                      <TextSelect
                        aria-label={`Estado de ${row.name} en ${zone.zoneName}`}
                        disabled={saving}
                        value={zone.mode}
                        onChange={(event) =>
                          updateZone(row.chapterId, zone.zoneId, {
                            mode: event.target.value as MarkMode,
                            percent: event.target.value === 'running' ? zone.percent : '',
                          })
                        }
                      >
                        <option value="open">Abierto</option>
                        <option value="running">En marcha</option>
                        <option value="completed">Completado</option>
                      </TextSelect>
                    </Field>
                    {zone.mode === 'running' ? (
                      <Field
                        label="Avance"
                        hint="Opcional. Vacío usa solo las actividades de esta zona."
                      >
                        <TextInput
                          type="number"
                          min={1}
                          max={99}
                          disabled={saving}
                          value={zone.percent}
                          placeholder="70"
                          onChange={(event) =>
                            updateZone(row.chapterId, zone.zoneId, {
                              percent: event.target.value,
                            })
                          }
                        />
                      </Field>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </Modal>
  )
}
