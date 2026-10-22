import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getObra } from '@/obras/api/obrasApi'
import { listActiveTaskBudgetActivities } from '@/task-pool/api/actividadesPresupuestalesApi'
import { listActiveTaskChapters } from '@/task-pool/api/capitulosApi'
import type { TaskBudgetActivity, TaskChapter } from '@/task-pool/model/types'
import {
  listObraPhotoGallery,
  listTasks,
  type GalleryPhoto,
} from '@/tareas/api/tareasApi'
import type { Task } from '@/tareas/model/types'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { Alert, Field, PaginationBar, TextSelect } from '@/shared/ui'
import styles from './PhotoGalleryPage.module.css'

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
  if (photo.subtaskName) return `${photo.taskName} · ${photo.subtaskName}`
  return photo.taskName
}

export function PhotoGalleryPage() {
  const { obraId: obraIdParam } = useParams()
  const navigate = useNavigate()
  const obraId = Number(obraIdParam)
  const [obraName, setObraName] = useState('')
  const [chapters, setChapters] = useState<TaskChapter[]>([])
  const [budgets, setBudgets] = useState<TaskBudgetActivity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [chapterId, setChapterId] = useState('')
  const [budgetId, setBudgetId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [page, setPage] = useState(1)
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(24)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useDocumentTitle(
    obraName ? `Quasar · ${obraName} · Galería` : 'Quasar · Galería',
  )

  useEffect(() => {
    if (!Number.isFinite(obraId)) return
    void getObra(obraId)
      .then((obra) => setObraName(obra.name))
      .catch(() => setObraName(''))
    void listActiveTaskChapters()
      .then(setChapters)
      .catch(() => setChapters([]))
    void (async () => {
      const first = await listTasks({ obraId, parentOnly: true, page: 1 })
      const all = [...first.tasks]
      const pages = Math.ceil(
        first.pagination.totalItems / first.pagination.itemsPerPage,
      )
      for (let next = 2; next <= pages && next <= 20; next += 1) {
        const data = await listTasks({ obraId, parentOnly: true, page: next })
        all.push(...data.tasks)
      }
      setTasks(all)
    })().catch(() => setTasks([]))
  }, [obraId])

  useEffect(() => {
    if (!chapterId) {
      setBudgets([])
      return
    }
    void listActiveTaskBudgetActivities({ chapterId: Number(chapterId) })
      .then(setBudgets)
      .catch(() => setBudgets([]))
  }, [chapterId])

  const load = useCallback(async () => {
    if (!Number.isFinite(obraId)) {
      setError('Obra inválida')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await listObraPhotoGallery({
        obraId,
        chapterId: chapterId ? Number(chapterId) : undefined,
        budgetActivityId: budgetId ? Number(budgetId) : undefined,
        taskId: taskId ? Number(taskId) : undefined,
        page,
      })
      setPhotos(data.photos)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la galería')
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }, [obraId, chapterId, budgetId, taskId, page])

  useEffect(() => {
    void load()
  }, [load])

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (chapterId && task.chapterId !== Number(chapterId)) return false
      if (budgetId && task.budgetActivityId !== Number(budgetId)) return false
      return true
    })
  }, [tasks, chapterId, budgetId])

  const openPhoto = openIndex != null ? photos[openIndex] : null

  useEffect(() => {
    if (openIndex == null) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenIndex(null)
      if (event.key === 'ArrowRight') {
        setOpenIndex((current) =>
          current == null || current >= photos.length - 1 ? current : current + 1,
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
  }, [openIndex, photos.length])

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={styles.back}
        onClick={() => navigate(`/dashboard/obras/${obraId}`)}
      >
        ← {obraName || 'Obra'}
      </button>
      <header>
        <h1 className={styles.title}>Galería</h1>
        <p className={styles.subtitle}>
          Evidencias de las actividades, de la más reciente a la más antigua.
        </p>
      </header>

      <div className={styles.filters}>
        <Field label="Capítulo">
          <TextSelect
            value={chapterId}
            onChange={(event) => {
              setChapterId(event.target.value)
              setBudgetId('')
              setTaskId('')
              setPage(1)
              setOpenIndex(null)
            }}
          >
            <option value="">Todos</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name}
              </option>
            ))}
          </TextSelect>
        </Field>
        <Field label="Actividad presupuestal">
          <TextSelect
            value={budgetId}
            disabled={!chapterId}
            onChange={(event) => {
              setBudgetId(event.target.value)
              setTaskId('')
              setPage(1)
              setOpenIndex(null)
            }}
          >
            <option value="">
              {chapterId ? 'Todas' : 'Elige un capítulo'}
            </option>
            {budgets.map((budget) => (
              <option key={budget.id} value={budget.id}>
                {budget.name}
              </option>
            ))}
          </TextSelect>
        </Field>
        <Field label="Actividad">
          <TextSelect
            value={taskId}
            onChange={(event) => {
              setTaskId(event.target.value)
              setPage(1)
              setOpenIndex(null)
            }}
          >
            <option value="">Todas</option>
            {visibleTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </TextSelect>
        </Field>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <p className={styles.empty}>Cargando fotos…</p> : null}
      {!loading && photos.length === 0 ? (
        <p className={styles.empty}>No hay evidencias con esos filtros.</p>
      ) : null}

      <ul className={styles.grid}>
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              className={styles.tile}
              onClick={() => setOpenIndex(index)}
            >
              <img src={photo.fileUrl} alt={photoLabel(photo)} />
              <span className={styles.tag}>{photo.taskName}</span>
            </button>
          </li>
        ))}
      </ul>

      <PaginationBar
        page={page}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onChange={(next) => {
          setPage(next)
          setOpenIndex(null)
        }}
      />

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
                {[openPhoto.chapterName, openPhoto.budgetActivityName]
                  .filter(Boolean)
                  .join(' · ') || 'Sin capítulo'}
              </p>
              <p className={styles.metaLine}>
                {`Subió ${openPhoto.uploadedByName || 'un usuario'} · ${formatWhen(
                  openPhoto.createdAt || openPhoto.takenAt,
                )}`}
              </p>
              {openPhoto.description ? (
                <p className={styles.metaLine}>{openPhoto.description}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className={styles.navBtn}
            disabled={openIndex === photos.length - 1}
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
