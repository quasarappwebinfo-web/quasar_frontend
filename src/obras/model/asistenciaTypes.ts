export type ObraDailyAttendance = {
  id: number
  obraId: number
  obraName?: string | null
  workDate: string
  workerId: number
  workerName?: string | null
  documentNumber?: string | null
  positionName?: string | null
  signedAt: string
  signatureType: string
  signatureData?: string | null
  recordedBy: number
  recordedByName?: string | null
  createdAt?: string | null
  removedAt?: string | null
}

export type ObraDailyAttendanceCreate = {
  obraId: number
  workDate: string
  workerId: number
  signatureType?: 'electronic' | 'acknowledgment'
  signatureData?: string | null
}
