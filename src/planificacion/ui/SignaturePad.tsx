import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import styles from './SignaturePad.module.css'

type SignaturePadProps = {
  disabled?: boolean
  onChange: (dataUrl: string | null) => void
}

export function SignaturePad({ disabled, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const strokeCount = useRef(0)
  const onChangeRef = useRef(onChange)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const ratio = window.devicePixelRatio || 1
    const width = Math.max(parent.clientWidth, 280)
    const height = 180
    canvas.width = Math.floor(width * ratio)
    canvas.height = Math.floor(height * ratio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a1c1f'
    ctx.lineWidth = 2.2
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    strokeCount.current = 0
    setEmpty(true)
    onChangeRef.current(null)
  }, [])

  useEffect(() => {
    resetCanvas()
    const onResize = () => resetCanvas()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [resetCanvas])

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  function emitData() {
    const canvas = canvasRef.current
    if (!canvas || strokeCount.current === 0) {
      onChangeRef.current(null)
      setEmpty(true)
      return
    }
    onChangeRef.current(canvas.toDataURL('image/png'))
    setEmpty(false)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const point = pointFromEvent(event)
    if (!canvas || !ctx || !point) return
    canvas.setPointerCapture(event.pointerId)
    drawing.current = true
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return
    const ctx = canvasRef.current?.getContext('2d')
    const point = pointFromEvent(event)
    if (!ctx || !point) return
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    strokeCount.current += 1
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    drawing.current = false
    try {
      canvasRef.current?.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
    emitData()
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.canvasBox}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {empty ? (
          <span className={styles.placeholder}>Dibuja tu firma aquí</span>
        ) : null}
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.clearBtn}
          onClick={resetCanvas}
          disabled={disabled || empty}
        >
          Limpiar
        </button>
      </div>
    </div>
  )
}
