import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // default
    proxy: {
      // anything starting with /api will be proxied to your backend
      '/api': {
        target: 'http://localhost:5000', // your backend dev server
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
