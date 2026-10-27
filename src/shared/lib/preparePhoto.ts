/**
 * Copia y reduce la foto antes de subirla.
 * En el celular el archivo original (sobre todo HEIC de iPhone) pesa varios MB:
 * Nginx corta la petición y el sync la deja colgada. Aquí queda un JPEG chico,
 * independiente del input file (Safari invalida el File si se limpia el input).
 */

const MAX_SIDE = 1600
const JPEG_QUALITY = 0.72
const SKIP_RECOMPRESS_BYTES = 900_000

export class PhotoPrepareError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhotoPrepareError'
  }
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim() || 'foto'
  return `${base}.jpg`
}

function normalizeType(type: string, name: string): string {
  const base = type.split(';', 1)[0]?.trim().toLowerCase() ?? ''
  if (base.startsWith('image/')) return base
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic' || ext === 'heif') return 'image/heic'
  return 'image/jpeg'
}

async function readFileBytes(file: Blob): Promise<ArrayBuffer> {
  try {
    const bytes = await file.arrayBuffer()
    if (!bytes.byteLength) {
      throw new PhotoPrepareError(
        'La foto llegó vacía. Vuelve a elegirla desde la galería.',
      )
    }
    return bytes
  } catch (err) {
    if (err instanceof PhotoPrepareError) throw err
    throw new PhotoPrepareError(
      'No se pudo leer la foto del celular. Vuelve a elegirla.',
    )
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) resolve(blob)
        else reject(new PhotoPrepareError('No se pudo preparar la foto para subirla.'))
      },
      'image/jpeg',
      quality,
    )
  })
}

async function decodeBitmap(file: Blob): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null
  const attempts: ImageBitmapOptions[] = [
    {
      imageOrientation: 'from-image',
      resizeWidth: MAX_SIDE,
      resizeQuality: 'medium',
    } as ImageBitmapOptions,
    { imageOrientation: 'from-image' } as ImageBitmapOptions,
    {},
  ]
  for (const options of attempts) {
    try {
      return await createImageBitmap(file, options)
    } catch {
      // El navegador puede rechazar HEIC o la opción de escala; se prueba la siguiente.
    }
  }
  return null
}

function decodeElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(
        new PhotoPrepareError(
          'No se pudo leer la foto. Prueba con JPEG, PNG o WebP.',
        ),
      )
    img.src = url
  })
}

async function compressToJpeg(file: File): Promise<File> {
  const bitmap = await decodeBitmap(file)
  let source: CanvasImageSource
  let width: number
  let height: number
  let objectUrl: string | null = null
  if (bitmap) {
    source = bitmap
    width = bitmap.width
    height = bitmap.height
  } else {
    objectUrl = URL.createObjectURL(file)
    try {
      const img = await decodeElement(objectUrl)
      source = img
      width = img.naturalWidth
      height = img.naturalHeight
    } catch (err) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
      throw err
    }
  }

  try {
    if (!width || !height) {
      throw new PhotoPrepareError('No se pudo leer el tamaño de la foto.')
    }
    const longest = Math.max(width, height)
    const scale = longest > MAX_SIDE ? MAX_SIDE / longest : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new PhotoPrepareError('Este navegador no puede preparar la foto.')
    }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

    let blob = await canvasToJpeg(canvas, JPEG_QUALITY)
    if (blob.size > SKIP_RECOMPRESS_BYTES) {
      blob = await canvasToJpeg(canvas, 0.55)
    }
    return new File([blob], jpegName(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    bitmap?.close()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

export async function preparePhotoFile(file: File): Promise<File> {
  const bytes = await readFileBytes(file)
  const type = normalizeType(file.type, file.name)
  const snapshot = new File([bytes], file.name || 'foto.jpg', {
    type,
    lastModified: file.lastModified || Date.now(),
  })
  if (
    type === 'image/jpeg' &&
    snapshot.size > 0 &&
    snapshot.size <= SKIP_RECOMPRESS_BYTES
  ) {
    return snapshot
  }
  return compressToJpeg(snapshot)
}
