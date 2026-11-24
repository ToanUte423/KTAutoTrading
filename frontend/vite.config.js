import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['ktautotrading.toanute423.space', 'localhost', '127.0.0.1'],
    proxy: {
      '/api/news': {
        target: 'https://cointelegraph.com/rss',
        changeOrigin: true,
        rewrite: () => ''
      }
    }
  }
})

