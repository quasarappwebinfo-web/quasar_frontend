import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProviders } from '@/app/providers/AppProviders'
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RequirePermission,
} from '@/app/routing/RouteGuards'
import { PlaceholderPage } from '@/app/ui/PlaceholderPage'
import { LoginPage } from '@/auth'
import { IdentidadPage } from '@/identidad'
import { PersonasPanel } from '@/identidad/ui/PersonasPanel'
import { RolesPanel } from '@/identidad/ui/RolesPanel'
import { UsersPanel } from '@/identidad/ui/UsersPanel'
import {
  DashboardPage,
  EtapasObraPanel,
  MaestrosObrasPage,
  ObraDetailPage,
  TiposDocumentoPanel,
  TiposVentaPanel,
} from '@/obras'
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
import { TasksHubPage, TasksKanbanPage } from '@/tareas'
import {
  WorkPlanComparePage,
  WorkPlanDetailPage,
  WorkPlansPage,
} from '@/planificacion'

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<Navigate to="/dashboard" replace />} />

            <Route element={<RequirePermission permission="obras" />}>
              <Route path="/dashboard/obras/:obraId" element={<ObraDetailPage />} />
              <Route
                path="/reports"
                element={
                  <PlaceholderPage
                    title="Reportes"
                    description="Aquí irán reportes y avances."
                  />
                }
              />
            </Route>

            <Route
              element={
                <RequirePermission permission={['catalogos', 'obras']} />
              }
            >
              <Route path="/dashboard/maestros" element={<MaestrosObrasPage />}>
                <Route index element={<Navigate to="tipos-venta" replace />} />
                <Route path="tipos-venta" element={<TiposVentaPanel />} />
                <Route path="etapas" element={<EtapasObraPanel />} />
                <Route path="tipos-documento" element={<TiposDocumentoPanel />} />
              </Route>
            </Route>

            <Route element={<RequirePermission permission="tareas" />}>
              <Route
                path="/dashboard/obras/:obraId/tareas"
                element={<TasksKanbanPage />}
              />
              <Route path="/tasks" element={<TasksHubPage />} />
            </Route>

            <Route element={<RequirePermission permission="planificacion" />}>
              <Route
                path="/dashboard/obras/:obraId/planes"
                element={<WorkPlansPage />}
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
                <Route index element={<Navigate to="categorias" replace />} />
                <Route path="categorias" element={<CategoriasPanel />} />
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
