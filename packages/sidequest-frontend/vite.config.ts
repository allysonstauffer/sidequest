import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { concealDevPaths } from './devServerGuard.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [concealDevPaths(), react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
