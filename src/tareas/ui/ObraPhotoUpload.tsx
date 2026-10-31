import { useEffect, useRef, useState } from 'react'
import { uploadObraPhotos } from '@/tareas/api/tareasApi'
import { preparePhotoFile } from '@/shared/lib/preparePhoto'
import {
  Alert,
  Button,
  Field,
  Modal,
  TextArea,
  UploadOverlay,
  useToast,
} from '@/shared/ui'
import styles from './PhotoGalleryPage.module.css'

type DraftPhoto = {
  key: string
  file: File
  preview: string
  description: string
}

type ObraPhotoUploadProps = {
  obraId: number
  label?: string
  size?: 'md' | 'sm'
  onUploaded?: () => void
}

export function ObraPhotoUpload({
  obraId,
  label = 'Elegir fotos',
  size = 'md',
  onUploaded,
}: ObraPhotoUploadProps) {
  const [drafts, setDrafts] = useState<DraftPhoto[]>([])
  const [preparing, setPreparing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const draftsRef = useRef<DraftPhoto[]>([])
  const toast = useToast()
  draftsRef.current = drafts

  useEffect(() => {
    return () => {
      draftsRef.current.forEach((draft) => URL.revokeObjectURL(draft.preview))
    }
  }, [])

  async function addDrafts(selected: File[]) {
    if (!selected.length) return
    const next: DraftPhoto[] = []
    const errors: string[] = []
    setPreparing(true)
    try {
      for (const file of selected) {
        try {
          const prepared = await preparePhotoFile(file)
          next.push({
            key: `${prepared.name}-${prepared.size}-${Date.now()}-${next.length}`,
            file: prepared,
            preview: URL.createObjectURL(prepared),
            description: '',
          })
        } catch (err) {
          errors.push(err instanceof Error ? err.message : 'No se pudo leer una foto')
        }
      }
    } finally {
      setPreparing(false)
    }
    if (!next.length) {
      if (errors[0]) toast.error(errors[0])
      return
    }
    const room = Math.max(0, 15 - draftsRef.current.length)
    const accepted = next.slice(0, room)
    next.slice(room).forEach((draft) => URL.revokeObjectURL(draft.preview))
    if (next.length > room) {
      errors.push('Puedes preparar hasta 15 fotos a la vez.')
    }
    if (accepted.length) {
      setDrafts((prev) => [...prev, ...accepted])
    }
    setUploadError(errors[0] ?? null)
  }

  function discardDrafts() {
    if (uploading) return
    drafts.forEach((draft) => URL.revokeObjectURL(draft.preview))
    setDrafts([])
    setUploadError(null)
  }

  function removeDraft(key: string) {
    setDrafts((prev) => {
      const found = prev.find((draft) => draft.key === key)
      if (found) URL.revokeObjectURL(found.preview)
      return prev.filter((draft) => draft.key !== key)
    })
  }

  async function submitDrafts() {
    if (!Number.isFinite(obraId) || drafts.length === 0) return
    const missing = drafts.some((draft) => !draft.description.trim())
    if (missing) {
      setUploadError('Escribe una descripción en cada foto.')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      await uploadObraPhotos({
        obraId,
        items: drafts.map((draft) => ({
          file: draft.file,
          description: draft.description.trim(),
        })),
      })
      drafts.forEach((draft) => URL.revokeObjectURL(draft.preview))
      const count = drafts.length
      setDrafts([])
      toast.success(count === 1 ? 'Foto subida' : `${count} fotos subidas`)
      onUploaded?.()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'No se pudieron subir las fotos')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        disabled={preparing || uploading}
        onClick={() => fileRef.current?.click()}
      >
        {label}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(event) => {
          const input = event.currentTarget
          const selected = input.files ? Array.from(input.files) : []
          void addDrafts(selected).finally(() => {
            input.value = ''
          })
        }}
      />
      <UploadOverlay
        open={preparing || uploading}
        label={uploading ? 'Subiendo fotos…' : 'Cargando imagen…'}
      />
      <Modal
        title="Descripción de las fotos"
        open={drafts.length > 0}
        wide
        onClose={discardDrafts}
        footer={
          <>
            <Button variant="ghost" disabled={uploading} onClick={discardDrafts}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              Añadir fotos
            </Button>
            <Button
              type="button"
              disabled={uploading || drafts.length === 0}
              onClick={() => void submitDrafts()}
            >
              {uploading ? 'Subiendo…' : 'Subir fotos'}
            </Button>
          </>
        }
      >
        <p className={styles.modalHint}>
          Escribe qué se ve en cada foto. Quién la sube y la hora quedan
          registrados al confirmar.
        </p>
        {uploadError ? <Alert tone="error">{uploadError}</Alert> : null}
        <div className={styles.drafts}>
          {drafts.map((draft, index) => (
            <div key={draft.key} className={styles.draft}>
              <img src={draft.preview} alt="" />
              <div className={styles.draftBody}>
                <div className={styles.draftHead}>
                  <p className={styles.draftIndex}>
                    Foto {index + 1} de {drafts.length}
                  </p>
                  <button
                    type="button"
                    className={styles.removeDraft}
                    disabled={uploading}
                    onClick={() => removeDraft(draft.key)}
                  >
                    Quitar
                  </button>
                </div>
                <Field label="Descripción">
                  <TextArea
                    rows={3}
                    value={draft.description}
                    disabled={uploading}
                    placeholder="Qué se ve en la foto"
                    onChange={(event) => {
                      const value = event.target.value
                      setDrafts((prev) =>
                        prev.map((item) =>
                          item.key === draft.key
                            ? { ...item, description: value }
                            : item,
                        ),
                      )
                    }}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}
