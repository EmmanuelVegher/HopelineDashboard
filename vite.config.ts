import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    exclude: ['genkit', '@genkit-ai/*'],
  },
  build: {
    rollupOptions: {
      external: ['src/ai/**', 'src/firebase/functions/**'],
    },
  },
})