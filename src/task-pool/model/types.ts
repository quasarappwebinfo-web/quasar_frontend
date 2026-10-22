import type { ActiveStatus, Pagination } from '@/identidad/model/types'

export type { ActiveStatus, Pagination }

export type VersionStatus = 'draft' | 'published' | 'archived'

export type DependencyType =
  | 'finish_to_start'
  | 'start_to_start'
  | 'finish_to_finish'
  | 'start_to_finish'

type NamedCatalog = {
  id: number
  name: string
  description: string | null
  displayOrder: number
  isActive: ActiveStatus
  createdAt?: string | null
}

export type TaskChapter = NamedCatalog & {
  stageId: number | null
  stageName: string | null
  weightPercent: number | string | null
}

export type TaskChapterWrite = {
  name: string
  stageId: number
  description?: string | null
  displayOrder?: number
  weightPercent?: number | null
}

export type TaskChapterUpdate = {
  name?: string
  stageId?: number | null
  description?: string | null
  displayOrder?: number
  weightPercent?: number | null
  isActive?: ActiveStatus
}

export type TaskZone = NamedCatalog
export type TaskZoneWrite = {
  name: string
  description?: string | null
  displayOrder?: number
}
export type TaskZoneUpdate = {
  name?: string
  description?: string | null
  displayOrder?: number
  isActive?: ActiveStatus
}

export type TaskBudgetActivity = {
  id: number
  chapterId: number | null
  chapterName: string | null
  zoneId: number | null
  zoneName: string | null
  name: string
  description: string | null
  displayOrder: number
  chapterWeightPercent: number | string | null
  zoneWeightPercent: number | string | null
  isActive: ActiveStatus
  createdAt?: string | null
}

export type TaskBudgetActivityWrite = {
  chapterId: number
  zoneId?: number | null
  name: string
  description?: string | null
  displayOrder?: number
  chapterWeightPercent?: number | null
  zoneWeightPercent?: number | null
}

export type TaskBudgetActivityUpdate = {
  chapterId?: number
  zoneId?: number | null
  name?: string
  description?: string | null
  displayOrder?: number
  chapterWeightPercent?: number | null
  zoneWeightPercent?: number | null
  isActive?: ActiveStatus
}

export type TaskTemplate = {
  id: number
  chapterId: number
  chapterName: string | null
  zoneId: number | null
  zoneName: string | null
  budgetActivityId: number | null
  budgetActivityName: string | null
  name: string
  code: string
  description: string | null
  budgetWeightPercent: number | string | null
  isActive: ActiveStatus
  createdAt?: string | null
}

export type TaskTemplateWrite = {
  chapterId: number
  zoneId?: number | null
  budgetActivityId: number
  name: string
  code: string
  description?: string | null
}

export type TaskTemplateUpdate = {
  chapterId?: number
  zoneId?: number | null
  budgetActivityId?: number | null
  name?: string
  description?: string | null
  isActive?: ActiveStatus
}

export type TaskTemplateVersion = {
  id: number
  taskTemplateId: number
  templateCode: string | null
  templateName: string | null
  versionNumber: number
  name: string
  description: string | null
  status: VersionStatus
  baseQuantity: string | number | null
  baseDurationDays: string | number | null
  publishedAt: string | null
  createdAt?: string | null
}

export type TaskTemplateVersionWrite = {
  taskTemplateId: number
  name: string
  description?: string | null
  baseQuantity?: number | null
  baseDurationDays?: number | null
  versionNumber?: number
  copyFromVersionId?: number | null
}

export type TaskTemplateVersionUpdate = {
  name?: string
  description?: string | null
  baseQuantity?: number | null
  baseDurationDays?: number | null
}

export type MeasurementUnit = {
  id: number
  name: string
  symbol: string
  isActive: ActiveStatus
}

export type VersionMeasurement = {
  id: number
  templateVersionId: number
  unitId: number
  unitName: string | null
  unitSymbol: string | null
  isPrimary: ActiveStatus | 0 | 1
  createdAt?: string | null
}

export type VersionPosition = {
  id: number
  templateVersionId: number
  workerPositionId: number
  positionName: string | null
  specialtyId: number | null
  specialtyName: string | null
  quantity: string | number
  isRequired: ActiveStatus | 0 | 1
  createdAt?: string | null
}

export type VersionSubtask = {
  id: number
  templateVersionId: number
  name: string
  description: string | null
  displayOrder: number
  isRequired: ActiveStatus | 0 | 1
  weightPercent: number | string
  createdAt?: string | null
}

export type VersionDependency = {
  id: number
  templateVersionId: number
  dependsOnTemplateId: number
  dependsOnTemplateCode?: string | null
  dependsOnTemplateName?: string | null
  dependencyType: DependencyType
  isRequired: ActiveStatus | 0 | 1
  blocksStart: ActiveStatus | 0 | 1
  description: string | null
  createdAt?: string | null
}

export type PreferredCrew = {
  id: number
  crewId?: number | null
  crewName?: string | null
  isPreferred?: number | null
}

export type VersionDetail = {
  version: TaskTemplateVersion
  measurements: VersionMeasurement[]
  positions: VersionPosition[]
  subtasks: VersionSubtask[]
  dependencies: VersionDependency[]
  preferredCrews?: PreferredCrew[]
}

export type RecommendedPosition = {
  workerPositionId: number
  positionName: string | null
  specialtyId?: number | null
  specialtyName?: string | null
  baseQuantity: string | number
  recommendedQuantity: string | number
  isRequired: ActiveStatus | 0 | 1
}

export type RecommendationResult = {
  templateVersionId: number
  templateCode: string | null
  versionNumber: number
  status: VersionStatus
  unitId?: number | null
  unitName?: string | null
  unitSymbol?: string | null
  baseQuantity: string | number
  baseDurationDays: string | number
  obraQuantity: string | number
  targetDurationDays?: string | number | null
  scaleFactor: string | number
  crewScaleFactor?: string | number | null
  recommendedDurationDays: string | number
  recommendedPositions: RecommendedPosition[]
  note: string
}

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  finish_to_start: 'Fin → Inicio',
  start_to_start: 'Inicio → Inicio',
  finish_to_finish: 'Fin → Fin',
  start_to_finish: 'Inicio → Fin',
}

export const VERSION_STATUS_LABELS: Record<VersionStatus, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  archived: 'Archivada',
}
