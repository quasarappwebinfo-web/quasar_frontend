# Quasar Frontend

Vite + React + TypeScript con **Screaming Architecture**.

## Arranque

```bash
cp .env.example .env   # ajusta VITE_API_URL si hace falta
npm install
npm run dev
```

Asegura que el origen del frontend (p. ej. `http://localhost:5173`) esté en `CORS_ORIGINS` del backend.

## Auth

- Access JWT solo en **memoria**
- Refresh en cookie **HttpOnly** con `credentials: 'include'`
- En local, `VITE_API_URL` vacío + proxy Vite (`/api` → `:8002`) para que la cookie sobreviva al F5
- Al arrancar: `refresh` → `/me`; si falla refresh → login
- Helper `apiFetch` con Bearer + reintento tras 401

## Estructura

```
src/
├── app/      # Shell
├── auth/     # Login y sesión
├── home/     # Post-login
├── shared/
└── main.tsx
```
