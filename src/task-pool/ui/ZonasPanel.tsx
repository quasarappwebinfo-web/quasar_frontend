import { useCallback } from 'react'
import {
  createTaskZone,
  listTaskZones,
  updateTaskZone,
} from '@/task-pool/api/zonasApi'
import { CatalogSimplePanel } from './CatalogSimplePanel'

export function ZonasPanel() {
  const listItems = useCallback(
    async (params: {
      page: number
      search: string
      activeOnly?: boolean
    }) => {
      const data = await listTaskZones(params)
      return {
        items: data.zones,
        totalItems: data.pagination.totalItems,
        itemsPerPage: data.pagination.itemsPerPage,
      }
    },
    [],
  )

  return (
    <CatalogSimplePanel
      singular="Zona"
      plural="Zonas"
      nameExample="Zona social"
      nameHelp="Ubicación de la obra. El avance de una actividad suma solo en su zona."
      weightLabel="% de la obra"
      weightHelp="Cuánto vale esta zona en la obra. Casa puede ser 70 y Zona social 30. Si se deja vacío, la zona no suma al avance."
      listItems={listItems}
      createItem={createTaskZone}
      updateItem={updateTaskZone}
    />
  )
}
