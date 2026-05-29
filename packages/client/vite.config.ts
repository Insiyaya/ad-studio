import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@app': resolve(__dirname, 'src/app'),
      '@features': resolve(__dirname, 'src/features'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },

  server: {
    port: 5173,
    // Accept any Host header so ngrok / tunnel URLs aren't rejected
    allowedHosts: true,
    proxy: {
      // Proxy API requests to the backend during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy WebSocket connections for real-time crawl progress
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    // Split vendor chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          zustand: ['zustand'],
        },
      },
    },
  },

  css: {
    modules: {
      // camelCase for CSS module class names
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]__[hash:base64:5]',
    },
  },
})
