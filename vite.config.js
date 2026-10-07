import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      '/cal-api': {
        target: 'https://api.cal.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cal-api/, '')
      }
    }
  }
})