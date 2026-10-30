import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 5178,
    https: true,
    strictPort: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    https: true,
  },
})
