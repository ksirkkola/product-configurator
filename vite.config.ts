import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dns from 'dns'
import { readFileSync } from 'node:fs'

dns.setDefaultResultOrder('verbatim');

const manifest = JSON.parse(readFileSync('./public/manifest.json', 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(manifest.version || '0.0.0') },
  server: {
    port: 3000,
    cors: true,
  },
})
