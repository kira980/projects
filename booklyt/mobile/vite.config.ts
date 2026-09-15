import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Capacitor serves from root, not /
  base: '/',
  build: {
    outDir: 'dist',
    // Inline small assets so the WebView doesn't need extra requests
    assetsInlineLimit: 4096,
  },
})
