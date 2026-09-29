/**
 * Base URL del API.
 * En desarrollo local dejamos vacío para usar el proxy de Vite (`/api` → backend)
 * y que la cookie de refresh sea same-origin (sobrevive al F5).
 * En prod: VITE_API_URL=https://api.tudominio.com (o vacío si hay reverse proxy).
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(
  /\/$/,
  '',
)
