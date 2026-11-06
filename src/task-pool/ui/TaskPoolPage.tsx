import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { cn } from '@/shared/lib/cn'
import { Button, Modal } from '@/shared/ui'
import styles from './taskPool.module.css'

const TABS = [
  { to: '/maestros/task-pool/plantillas', label: 'Actividades Registradas', end: true },
  { to: '/maestros/task-pool/capitulos', label: 'Capítulos', end: true },
  {
    to: '/maestros/task-pool/actividades-presupuestales',
    label: 'Subcapítulos',
    end: true,
  },
  { to: '/maestros/task-pool/zonas', label: 'Zonas', end: true },
  { to: '/maestros/task-pool/unidades', label: 'Unidades', end: true },
] as const

const GUIDE_STEPS = [
  {
    title: 'Crea las unidades de medida',
    text: 'En la pestaña Unidades, crea las que uses (m², m³, und…). Luego podrás elegirlas en cada versión de Actividad Registrada.',
  },
  {
    title: 'Crea el capítulo',
    text: 'En Capítulos define el grupo de la obra y, si quieres, qué porcentaje aporta al avance. A partir de ahí se arman los subcapítulos y las actividades registradas.',
  },
  {
    title: 'Crea la Actividad Registrada',
    text: 'Ve a Actividades Registradas → «Nueva Actividad Registrada». Capítulo, subcapítulo y nombre son obligatorios. La zona es opcional.',
  },
  {
    title: 'Abre la Actividad Registrada y crea una versión',
    text: 'Entra a «Ver versiones» y pulsa «Nueva versión». Basta el nombre. Cantidad y duración son opcionales. Puedes clonar desde otra versión si ya tienes una lista.',
  },
  {
    title: 'Completa el detalle del borrador',
    text: 'Unidad, cargos, subactividades y dependencias son opcionales. Si agregas una fila, esa fila sí pide sus datos (por ejemplo, el cargo y la cantidad de personas).',
  },
  {
    title: 'Publica la versión',
    text: 'Pulsa «Publicar» aunque cantidad, duración y detalle estén vacíos. La versión queda inmutable. Para cambiarla, crea una nueva versión.',
  },
  {
    title: 'Prueba la recomendación (opcional)',
    text: 'En una versión publicada que tenga cantidad y duración base, usa «Recomendar». Verás duración y cargos sugeridos. Son solo recomendaciones: nadie aprueba aquí.',
  },
] as const

function titleFromPath(pathname: string): string {
  if (pathname.includes('/capitulos')) return 'Capítulos'
  if (pathname.includes('/zonas')) return 'Zonas'
  if (pathname.includes('/actividades-presupuestales')) {
    return 'Subcapítulos'
  }
  if (pathname.includes('/unidades')) return 'Unidades'
  return 'Actividades Registradas'
}

export function TaskPoolPage() {
  const location = useLocation()
  const [helpOpen, setHelpOpen] = useState(false)
  const section = titleFromPath(location.pathname)
  useDocumentTitle(`Quasar · Listado General Act. · ${section}`)


  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Catálogo</p>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Listado General Act.</h1>
            <button
              type="button"
              className={styles.helpBtn}
              aria-label="Cómo crear una Actividad Registrada"
              title="Cómo crear una Actividad Registrada"
              onClick={() => setHelpOpen(true)}
            >
              ?
            </button>
          </div>
          <p className={styles.subtitle}>
            Biblioteca de Actividades Registradas constructivas versionadas. El sistema
            recomienda; nadie auto-aprueba.
          </p>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Listado General Act.">
        {TABS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            role="tab"
            className={({ isActive }) => cn(styles.tab, isActive && styles.tabActive)}
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      <Outlet />

      <Modal
        title="Cómo crear una actividad en la base"
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        wide
        footer={
          <Button onClick={() => setHelpOpen(false)}>Entendido</Button>
        }
      >
        <div className={styles.helpGuide}>
          <p className={styles.helpLead}>
            El listado no son las actividades de una obra: es el catálogo
            de Actividades Registradas reutilizables. Sigue estos pasos desde cero:
          </p>
          <ol className={styles.helpSteps}>
            {GUIDE_STEPS.map((step, index) => (
              <li key={step.title} className={styles.helpStep}>
                <span className={styles.helpStepNum}>{index + 1}</span>
                <div className={styles.helpStepBody}>
                  <p className={styles.helpStepTitle}>{step.title}</p>
                  <p className={styles.helpStepText}>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className={styles.helpNote}>
            Si más adelante quieres cambiar una versión ya publicada, no la
            edites: crea una <strong>nueva versión</strong> (puedes clonarla) y
            publica esa. La anterior se puede archivar.
          </p>
        </div>
      </Modal>
    </div>
  )
}
