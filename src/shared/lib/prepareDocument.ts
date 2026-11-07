/**
 * Reduce imágenes antes de subirlas. Un plano en PNG o una foto grande
 * queda en JPEG chico. PDF y otros archivos se envían como están,
 * siempre que no pasen de 25 MB.
 */

const MAX_BYTES = 25 * 1024 * 1024
const MAX_SIDE = 2000
const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'gif',
  'bmp',
])

export class DocumentPrepareError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocumentPrepareError'
  }
}

function extension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function isImage(file: File): boolean {
  if (file.type.toLowerCase().startsWith('image/')) return true
  return IMAGE_EXTENSIONS.has(extension(file.name))
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim() || 'archivo'
  return `${base}.jpg`
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) resolve(blob)
        else reject(new DocumentPrepareError('No se pudo comprimir la imagen.'))
      },
      'image/jpeg',
      quality,
    )
  })
}

async function decodeBitmap(file: Blob): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null
  const attempts: ImageBitmapOptions[] = [
    { imageOrientation: 'from-image', resizeWidth: MAX_SIDE } as ImageBitmapOptions,
    { imageOrientation: 'from-image' } as ImageBitmapOptions,
    {},
  ]
  for (const options of attempts) {
    try {
      return await createImageBitmap(file, options)
    } catch {
      // HEIC u opciones no soportadas: se prueba la siguiente.
    }
  }
  return null
}

async function compressImage(file: File): Promise<File> {
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
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image()
        element.onload = () => resolve(element)
        element.onerror = () => reject(new DocumentPrepareError('No se pudo leer la imagen.'))
        element.src = objectUrl as string
      })
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
      throw new DocumentPrepareError('No se pudo leer el tamaño de la imagen.')
    }
    const longest = Math.max(width, height)
    const scale = longest > MAX_SIDE ? MAX_SIDE / longest : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new DocumentPrepareError('Este navegador no puede comprimir la imagen.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

    let quality = 0.62
    let blob = await canvasToJpeg(canvas, quality)
    while (blob.size > 700_000 && quality > 0.38) {
      quality = Math.max(0.38, quality - 0.08)
      blob = await canvasToJpeg(canvas, quality)
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

export async function prepareDocumentFile(file: File): Promise<File> {
  if (!file.size) {
    throw new DocumentPrepareError(`«${file.name || 'archivo'}» está vacío.`)
  }
  if (file.size > MAX_BYTES) {
    throw new DocumentPrepareError(
      `«${file.name || 'archivo'}» pesa más de 25 MB.`,
    )
  }
  if (!isImage(file)) return file
  const prepared = await compressImage(file)
  if (prepared.size > MAX_BYTES) {
    throw new DocumentPrepareError(
      `«${file.name || 'archivo'}» sigue pesando más de 25 MB después de comprimirlo.`,
    )
  }
  return prepared
}
