import dashboardUrl from './icons/dashboard.svg'
import personalUrl from './icons/personal.svg'
import rrhhUrl from './icons/rrhh.svg'
import proyectosUrl from './icons/proyectos.svg'
import tareasUrl from './icons/tareas.svg'
import reportesUrl from './icons/reportes.svg'
import chevronUrl from './icons/chevron.svg'
import type { SidebarItemId } from '@/app/ui/Sidebar/nav'

export const NAV_ICON_URLS: Record<SidebarItemId, string> = {
  dashboard: dashboardUrl,
  personal: personalUrl,
  rrhh: rrhhUrl,
  proyectos: proyectosUrl,
  actividades: tareasUrl,
  reportes: reportesUrl,
}

export const CHEVRON_ICON_URL = chevronUrl
