/** Registra el service worker de Quasar (PWA shell). */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) {
    // En Vite/HMR el SW puede interferir; se habilita en preview/prod.
    return
  }
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    // Silencioso: PWA opcional
  }
}
