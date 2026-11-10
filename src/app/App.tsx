import { BrowserRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { AppProviders } from '@/app/providers/AppProviders'
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RequirePermission,
} from '@/app/routing/RouteGuards'
import { LoginPage, RecoverAccessPage } from '@/auth'
import { IdentidadPage } from '@/identidad'
import { PersonasPanel } from '@/identidad/ui/PersonasPanel'
import { RolesPanel } from '@/identidad/ui/RolesPanel'
import { UsersPanel } from '@/identidad/ui/UsersPanel'
import { DashboardPage, ObraActivitiesPage, ObraAttendancePage, ObraDetailPage } from '@/obras'
import { ReportsPage } from '@/reportes/ui/ReportsPage'
import { RrhhPage } from '@/rrhh'
import { CargosPanel } from '@/rrhh/ui/CargosPanel'
import { EspecialidadesPanel } from '@/rrhh/ui/EspecialidadesPanel'
import { TrabajadoresPanel } from '@/rrhh/ui/TrabajadoresPanel'
import {
  ActividadesPresupuestalesPanel,
  CategoriasPanel,
  PlantillaDetailPage,
  PlantillasPanel,
  TaskPoolPage,
  UnidadesPanel,
  VersionEditorPage,
  ZonasPanel,
} from '@/task-pool'
import {
  GalleriesHubPage,
  PhotoGalleryPage,
  TasksHubPage,
  TasksKanbanPage,
} from '@/tareas'
import { WorkPlanComparePage, WorkPlanDetailPage } from '@/planificacion'

function ObraPlanesRedirect() {
  const { obraId } = useParams()
  const [params] = useSearchParams()
  const nuevo = params.get('nuevo') === '1' ? '?nuevo=1' : ''
  return <Navigate to={`/dashboard/obras/${obraId}/tareas${nuevo}`} replace />
}

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/recuperar" element={<RecoverAccessPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<Navigate to="/dashboard" replace />} />

            <Route element={<RequirePermission permission="obras" />}>
              <Route path="/dashboard/obras/:obraId" element={<ObraDetailPage />} />
              <Route
                path="/dashboard/obras/:obraId/actividades"
                element={<ObraActivitiesPage />}
              />
              <Route
                path="/dashboard/obras/:obraId/asistencia"
                element={<ObraAttendancePage />}
              />
              <Route path="/reports" element={<ReportsPage />} />
            </Route>

            <Route
              path="/dashboard/maestros/*"
              element={<Navigate to="/dashboard" replace />}
            />

            <Route element={<RequirePermission permission="tareas" />}>
              <Route
                path="/dashboard/obras/:obraId/tareas"
                element={<TasksKanbanPage />}
              />
              <Route
                path="/dashboard/obras/:obraId/galeria"
                element={<PhotoGalleryPage />}
              />
              <Route path="/tasks" element={<TasksHubPage />} />
              <Route path="/galleries" element={<GalleriesHubPage />} />
            </Route>

            <Route element={<RequirePermission permission="planificacion" />}>
              <Route
                path="/dashboard/obras/:obraId/planes"
                element={<ObraPlanesRedirect />}
              />
              <Route
                path="/dashboard/planes/:planId"
                element={<WorkPlanDetailPage />}
              />
              <Route
                path="/dashboard/planes/:planId/comparar"
                element={<WorkPlanComparePage />}
              />
            </Route>

            <Route
              element={
                <RequirePermission permission={['task_pool', 'catalogos']} />
              }
            >
              <Route path="/maestros/task-pool" element={<TaskPoolPage />}>
                <Route index element={<Navigate to="plantillas" replace />} />
                <Route
                  path="etapas"
                  element={<Navigate to="/maestros/task-pool/plantillas" replace />}
                />
                <Route path="capitulos" element={<CategoriasPanel />} />
                <Route
                  path="categorias"
                  element={<Navigate to="/maestros/task-pool/capitulos" replace />}
                />
                <Route path="zonas" element={<ZonasPanel />} />
                <Route
                  path="actividades-presupuestales"
                  element={<ActividadesPresupuestalesPanel />}
                />
                <Route path="unidades" element={<UnidadesPanel />} />
                <Route path="plantillas" element={<PlantillasPanel />} />
              </Route>
              <Route
                path="/maestros/task-pool/plantillas/:templateId"
                element={<PlantillaDetailPage />}
              />
              <Route
                path="/maestros/task-pool/versiones/:versionId"
                element={<VersionEditorPage />}
              />
            </Route>

            <Route element={<RequirePermission permission="identidad" />}>
              <Route path="/persons" element={<IdentidadPage />}>
                <Route index element={<PersonasPanel />} />
                <Route path="roles" element={<RolesPanel />} />
                <Route path="users" element={<UsersPanel />} />
              </Route>
            </Route>

            <Route element={<RequirePermission permission="rrhh" />}>
              <Route path="/rrhh" element={<RrhhPage />}>
                <Route index element={<Navigate to="cargos" replace />} />
                <Route path="cargos" element={<CargosPanel />} />
                <Route path="especialidades" element={<EspecialidadesPanel />} />
                <Route path="trabajadores" element={<TrabajadoresPanel />} />
                <Route
                  path="asignaciones"
                  element={<Navigate to="/rrhh/trabajadores" replace />}
                />
                <Route
                  path="cuadrillas"
                  element={<Navigate to="/rrhh/trabajadores" replace />}
                />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  )
}
