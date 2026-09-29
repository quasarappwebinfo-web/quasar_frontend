import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const apiTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8002'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  server: {
    proxy: {
      // Same-origin en dev: la cookie HttpOnly de refresh queda en :5173
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
