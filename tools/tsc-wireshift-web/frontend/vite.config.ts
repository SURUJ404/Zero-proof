import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'remove-use-client',
      transform(code, id) {
        if (id.endsWith('.tsx') || id.endsWith('.jsx')) {
          return code.replace(/"use client"\s*;?/, '');
        }
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    assetsInlineLimit: 0,
    outDir: 'dist',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  publicDir: 'public',
})
