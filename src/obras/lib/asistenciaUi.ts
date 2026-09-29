const COLOMBIA_TZ = 'America/Bogota'

/** Fecha de hoy en zona horaria de Colombia (YYYY-MM-DD). */
export function todayColombiaIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function formatColombiaDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString('es-CO', {
    timeZone: COLOMBIA_TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

/** Backend persiste hora de Colombia naive; si no trae zona, asumir Bogotá. */
export function formatAttendanceDateTime(value?: string | null): string {
  if (!value) return '—'
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())
  const normalized = hasZone
    ? value
    : `${value}${value.includes('T') ? '' : 'T00:00:00'}-05:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-CO', {
    timeZone: COLOMBIA_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatAttendanceTime(value?: string | null): string {
  if (!value) return '—'
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())
  const normalized = hasZone
    ? value
    : `${value}${value.includes('T') ? '' : 'T00:00:00'}-05:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString('es-CO', {
    timeZone: COLOMBIA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  })
}
