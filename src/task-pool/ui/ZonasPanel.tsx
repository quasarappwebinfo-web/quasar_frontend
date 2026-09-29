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
      nameHelp="Ubicación / ámbito de la obra (ej. Casa, Zona social, Exteriores)."
      listItems={listItems}
      createItem={createTaskZone}
      updateItem={updateTaskZone}
    />
  )
}
