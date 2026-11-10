import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getObra, listObras } from '@/obras/api/obrasApi'
import { OBRA_STATUS_OPTIONS, resolveObraCover } from '@/obras/lib/obraUi'
import { ObraFormModal } from '@/obras/ui/ObraFormModal'
import type { Obra } from '@/obras/model/types'
import { listActiveTaskChapters } from '@/task-pool/api/capitulosApi'
import { chapterSortRank, sortChapters } from '@/task-pool/lib/chapterOrder'
import type { TaskChapter } from '@/task-pool/model/types'
import { listObraPhotoGallery, type GalleryPhoto } from '@/tareas/api/tareasApi'
import { ObraPhotoUpload } from '@/tareas/ui/ObraPhotoUpload'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { Alert } from '@/shared/ui'
import styles from './PhotoGalleryPage.module.css'
import pickStyles from './tareas.module.css'

const PAGE_SIZE = 20

function formatWhen(value?: string | null): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(date)
}

function photoLabel(photo: GalleryPhoto): string {
  if (photo.kind === 'obra') return photo.description || 'Foto de la obra'
  if (photo.subtaskName) return `${photo.taskName} · ${photo.subtaskName}`
  return photo.taskName
}

export function PhotoGalleryPage() {
  const { obraId: obraIdParam } = useParams()
  const navigate = useNavigate()
  const obraId = Number(obraIdParam)
  const [obra, setObra] = useState<Obra | null>(null)
  const [chapters, setChapters] = useState<TaskChapter[]>([])
  const [chapterId, setChapterId] = useState('')
  const [kind, setKind] = useState<'' | 'task' | 'obra'>('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(PAGE_SIZE)
  const [latestAt, setLatestAt] = useState<string | null>(null)
  const [obraPhotoTotal, setObraPhotoTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const obraName = obra?.name || ''

  useDocumentTitle(
    obraName ? `Quasar · ${obraName} · Galería` : 'Quasar · Galería',
  )

  useEffect(() => {
    if (!Number.isFinite(obraId)) return
    void getObra(obraId)
      .then(setObra)
      .catch(() => setObra(null))
    void listActiveTaskChapters()
      .then(setChapters)
      .catch(() => setChapters([]))
  }, [obraId])

  const load = useCallback(async () => {
    if (!Number.isFinite(obraId)) {
      setError('Obra inválida')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [data, obraPhotos] = await Promise.all([
        listObraPhotoGallery({
          obraId,
          chapterId: kind === 'obra' || !chapterId ? undefined : Number(chapterId),
          kind: kind || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
        listObraPhotoGallery({ obraId, kind: 'obra', page: 1, pageSize: 1 }),
      ])
      setPhotos(data.photos)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
      setObraPhotoTotal(obraPhotos.pagination.totalItems)
      if (page === 1) {
        const newest = data.photos[0]
        setLatestAt(newest?.createdAt || newest?.takenAt || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la galería')
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }, [obraId, chapterId, kind, page])

  useEffect(() => {
    void load()
  }, [load])

  const orderedPhotos = useMemo(() => {
    const when = (photo: GalleryPhoto) => {
      const raw = photo.takenAt || photo.createdAt
      const time = raw ? new Date(raw).getTime() : 0
      return Number.isNaN(time) ? 0 : time
    }
    const needle = query.trim().toLocaleLowerCase('es')
    return [...photos]
      .sort((a, b) => when(b) - when(a) || b.id - a.id)
      .filter((photo) => {
        if (!needle) return true
        const haystack = [
          photo.taskName,
          photo.description,
          photo.chapterName,
          photo.budgetActivityName,
          photo.subtaskName,
          photo.uploadedByName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('es')
        return haystack.includes(needle)
      })
  }, [photos, query])

  const openPhoto = openIndex != null ? orderedPhotos[openIndex] : null

  useEffect(() => {
    if (openIndex == null) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenIndex(null)
      if (event.key === 'ArrowRight') {
        setOpenIndex((current) =>
          current == null || current >= orderedPhotos.length - 1
            ? current
            : current + 1,
        )
      }
      if (event.key === 'ArrowLeft') {
        setOpenIndex((current) =>
          current == null || current <= 0 ? current : current - 1,
        )
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openIndex, orderedPhotos.length])

  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(itemsPerPage, 1)))
  const rangeLabel = obra
    ? formatRange(obra.startDate, obra.estimatedEndDate)
    : ''

  function selectAll() {
    setKind('')
    setChapterId('')
    setPage(1)
    setOpenIndex(null)
  }

  function selectObraPhotos() {
    setKind('obra')
    setChapterId('')
    setPage(1)
    setOpenIndex(null)
  }

  function selectChapter(id: number) {
    setKind('task')
    setChapterId(String(id))
    setPage(1)
    setOpenIndex(null)
  }

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={styles.back}
        onClick={() => navigate(`/dashboard/obras/${obraId}`)}
      >
        ← Volver a la obra
      </button>

      <header className={styles.hero}>
        <div className={styles.identity}>
          {obra ? (
            <img className={styles.cover} src={resolveObraCover(obra)} alt="" />
          ) : (
            <span className={styles.cover} />
          )}
          <div>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{obraName || 'Galería'}</h1>
              {obra ? (
                <span className={obra.isActive === 1 ? styles.status : styles.statusOff}>
                  {statusLabel(obra)}
                </span>
              ) : null}
            </div>
            <p className={styles.subtitle}>Galería de la obra</p>
          </div>
        </div>
        <div className={styles.heroActions}>
          {rangeLabel ? <span className={styles.range}>{rangeLabel}</span> : null}
          <button type="button" className={styles.editBtn} onClick={() => setEditOpen(true)} disabled={!obra}>
            Editar
          </button>
        </div>
      </header>

      <div className={styles.tabs}>
        <button type="button" className={styles.tabOn}>
          <TabGlyph kind="gallery" /> Galería
        </button>
        <button
          type="button"
          className={styles.tab}
          onClick={() => navigate(`/dashboard/obras/${obraId}`)}
        >
          <TabGlyph kind="documents" /> Documentos
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.chips}>
          <button
            type="button"
            className={!kind && !chapterId ? styles.chipOn : styles.chip}
            onClick={selectAll}
          >
            <span className={styles.chipMark} style={{ color: '#1d4ed8', background: '#e8f1ff' }}>
              <ChipGlyph kind="all" />
            </span>
            Todos
          </button>
          <button
            type="button"
            className={kind === 'obra' ? styles.chipOn : styles.chip}
            onClick={selectObraPhotos}
          >
            <span className={styles.chipMark} style={{ color: '#15803d', background: '#e8f7ee' }}>
              <ChipGlyph kind="site" />
            </span>
            Avance de obra
          </button>
          {sortChapters(chapters).map((chapter) => {
            const accent = chapterAccent(chapter.name)
            return (
              <button
                key={chapter.id}
                type="button"
                className={kind === 'task' && chapterId === String(chapter.id) ? styles.chipOn : styles.chip}
                onClick={() => selectChapter(chapter.id)}
              >
                <span className={styles.chipMark} style={{ color: accent.ink, background: accent.soft }}>
                  <ChipGlyph kind="chapter" />
                </span>
                {chapter.name}
              </button>
            )
          })}
        </div>
        <div className={styles.toolbarEnd}>
          <input
            className={styles.search}
            type="search"
            value={query}
            placeholder="Buscar fotos..."
            onChange={(event) => {
              setQuery(event.target.value)
              setOpenIndex(null)
            }}
          />
          <ObraPhotoUpload
            obraId={obraId}
            className={styles.uploadBtn}
            label={
              <>
                <UploadGlyph /> Subir fotos
              </>
            }
            onUploaded={() => {
              setOpenIndex(null)
              const stay = kind === 'obra' && page === 1
              setKind('obra')
              setPage(1)
              if (stay) void load()
            }}
          />
        </div>
      </div>

      <section className={styles.stats}>
        <article className={styles.stat}>
          <span className={styles.statIcon} style={{ color: '#1d4ed8', background: '#e8f1ff' }}>
            <StatGlyph kind="photos" />
          </span>
          <div>
            <p className={styles.statValue}>{totalItems}</p>
            <p className={styles.statLabel}>Total de fotos</p>
          </div>
        </article>
        <article className={styles.stat}>
          <span className={styles.statIcon} style={{ color: '#15803d', background: '#e8f7ee' }}>
            <StatGlyph kind="date" />
          </span>
          <div>
            <p className={styles.statValue}>{latestAt ? formatDay(latestAt) : 'Sin fecha'}</p>
            <p className={styles.statLabel}>Última actualización</p>
          </div>
        </article>
        <article className={styles.stat}>
          <span className={styles.statIcon} style={{ color: '#c2410c', background: '#fff1e8' }}>
            <StatGlyph kind="chapters" />
          </span>
          <div>
            <p className={styles.statValue}>{chapters.length}</p>
            <p className={styles.statLabel}>Capítulos</p>
          </div>
        </article>
        <article className={styles.stat}>
          <span className={styles.statIcon} style={{ color: '#6d28d9', background: '#f3e8ff' }}>
            <StatGlyph kind="site" />
          </span>
          <div>
            <p className={styles.statValue}>{obraPhotoTotal ?? '—'}</p>
            <p className={styles.statLabel}>Fotos de la obra</p>
          </div>
        </article>
      </section>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <p className={styles.empty}>Cargando fotos…</p> : null}
      {!loading && orderedPhotos.length === 0 ? (
        <p className={styles.empty}>No hay fotos con ese filtro.</p>
      ) : null}

      {orderedPhotos.length > 0 ? (
        <ul className={orderedPhotos.length === 1 ? styles.single : styles.mosaic}>
          {orderedPhotos.map((photo, index) => {
            const searching = query.trim().length > 0
            const position = searching ? index + 1 : (page - 1) * itemsPerPage + index + 1
            const total = searching ? orderedPhotos.length : totalItems
            return (
              <li key={`${photo.kind || 'task'}-${photo.id}`} className={index === 0 ? styles.feature : undefined}>
                <button type="button" className={styles.tile} onClick={() => setOpenIndex(index)}>
                  <img src={photo.fileUrl} alt={photoLabel(photo)} />
                  <span className={styles.expand} aria-hidden="true">
                    <ExpandIcon />
                  </span>
                  {index === 0 ? (
                    <span className={styles.counter}>
                      {position}/{total}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      <footer className={styles.footer}>
        <p>Las fotos se ordenan por fecha de carga, de más recientes a más antiguas.</p>
        {totalItems > 0 ? (
          <div className={styles.pager}>
            {pageNumbers(page, totalPages).map((number) => (
              <button
                key={number}
                type="button"
                className={number === page ? styles.pageOn : styles.pageBtn}
                onClick={() => {
                  setPage(number)
                  setOpenIndex(null)
                }}
              >
                {number}
              </button>
            ))}
            <span className={styles.pageSize}>{itemsPerPage} / pág.</span>
          </div>
        ) : null}
      </footer>

      {obra ? (
        <ObraFormModal
          open={editOpen}
          obra={obra}
          onClose={() => setEditOpen(false)}
          onSaved={(next) => setObra(next)}
        />
      ) : null}

      {openPhoto ? (
        <div className={styles.lightbox} role="dialog" aria-modal="true">
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setOpenIndex(null)}
          >
            Cerrar
          </button>
          <button
            type="button"
            className={styles.navBtn}
            disabled={openIndex === 0}
            aria-label="Foto anterior"
            onClick={() =>
              setOpenIndex((current) => (current == null ? current : current - 1))
            }
          >
            ‹
          </button>
          <div className={styles.stage}>
            <img src={openPhoto.fileUrl} alt={photoLabel(openPhoto)} />
            <div className={styles.meta}>
              <p className={styles.metaTitle}>{photoLabel(openPhoto)}</p>
              <p className={styles.metaLine}>
                {openPhoto.kind === 'obra'
                  ? 'Foto de la obra, sin actividad'
                  : [openPhoto.chapterName, openPhoto.budgetActivityName]
                      .filter(Boolean)
                      .join(' · ') || 'Sin capítulo'}
              </p>
              <p className={styles.metaLine}>
                {`Subió ${openPhoto.uploadedByName || 'un usuario'} · ${formatWhen(
                  openPhoto.createdAt || openPhoto.takenAt,
                )}`}
              </p>
              {openPhoto.description && openPhoto.kind !== 'obra' ? (
                <p className={styles.metaLine}>{openPhoto.description}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className={styles.navBtn}
            disabled={openIndex === orderedPhotos.length - 1}
            aria-label="Foto siguiente"
            onClick={() =>
              setOpenIndex((current) => (current == null ? current : current + 1))
            }
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  )
}

function statusLabel(obra: Obra): string {
  if (obra.isActive !== 1) return 'Inactiva'
  return OBRA_STATUS_OPTIONS.find((item) => item.value === obra.status)?.label || 'En ejecución'
}

function formatRange(start: string | null, end: string | null): string {
  const from = formatDay(start)
  const to = formatDay(end)
  if (from && to) return `${from} - ${to}`
  return from || to
}

function formatDay(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date
    .toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace('.', '')
}

function pageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const start = Math.max(1, Math.min(current - 2, total - 4))
  return Array.from({ length: 5 }, (_, index) => start + index)
}

function chapterAccent(name: string): { ink: string; soft: string } {
  const palette = [
    { ink: '#1d4ed8', soft: '#e8f1ff' },
    { ink: '#c2410c', soft: '#fff1e8' },
    { ink: '#a16207', soft: '#fef9c3' },
    { ink: '#0369a1', soft: '#e0f2fe' },
    { ink: '#475569', soft: '#f1f5f9' },
    { ink: '#15803d', soft: '#e8f7ee' },
  ]
  return palette[chapterSortRank(name)] ?? { ink: '#334155', soft: '#f1f5f9' }
}

function ChipGlyph({ kind }: { kind: 'all' | 'site' | 'chapter' }) {
  if (kind === 'all') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />
      </svg>
    )
  }
  if (kind === 'site') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M9 4h6l1 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1-2Zm3 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 20V9l8-5 8 5v11h-5v-6H9v6H4Z" />
    </svg>
  )
}

function TabGlyph({ kind }: { kind: 'gallery' | 'documents' }) {
  return kind === 'gallery' ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 5h7v6H4V5Zm9 0h7v6h-7V5ZM4 13h7v6H4v-6Zm9 0h7v6h-7v-6Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5L14 3.5ZM8 12h8v2H8v-2Zm0 4h8v2H8v-2Z" />
    </svg>
  )
}

function StatGlyph({ kind }: { kind: 'photos' | 'date' | 'chapters' | 'site' }) {
  if (kind === 'date') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2Zm13 8H4v10h16V10Z" />
      </svg>
    )
  }
  if (kind === 'chapters') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M4 4h16v4H4V4Zm0 6h10v4H4v-4Zm0 6h16v4H4v-4Z" />
      </svg>
    )
  }
  if (kind === 'site') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M4 5h16v12H4V5Zm2 2v8h12V7H6Zm2 10h8v2H8v-2Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M9 4h6l1 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1-2Zm3 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
    </svg>
  )
}

function UploadGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 4l5 5h-3v6h-4V9H7l5-5Zm-7 14h14v2H5v-2Z" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 4v-4h2v6h-6v-2h4Z"
      />
    </svg>
  )
}

export function GalleriesHubPage() {
  const navigate = useNavigate()
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useDocumentTitle('Quasar · Galerías obras')

  useEffect(() => {
    setLoading(true)
    void listObras({ page: 1, activeOnly: true })
      .then((data) => setObras(data.obras))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'No se pudieron cargar obras'),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={pickStyles.page}>
      <header className={pickStyles.header}>
        <div className={pickStyles.titleBlock}>
          <h1 className={pickStyles.title}>Galerías obras</h1>
          <p className={pickStyles.subtitle}>
            Elige un proyecto para abrir su galería de fotos.
          </p>
        </div>
      </header>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? (
        <p className={pickStyles.empty}>Cargando proyectos…</p>
      ) : obras.length === 0 ? (
        <p className={pickStyles.empty}>No hay obras activas.</p>
      ) : (
        <div className={pickStyles.obraPick}>
          {obras.map((obra) => (
            <button
              key={obra.id}
              type="button"
              className={pickStyles.obraOption}
              onClick={() => navigate(`/dashboard/obras/${obra.id}/galeria`)}
            >
              <strong>{obra.name}</strong>
              <span className={pickStyles.assigneeRole}>
                {obra.city || 'Sin ciudad'} · Abrir galería →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
