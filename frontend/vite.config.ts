import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false, // Allow port fallback if 5173 is taken
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/storage': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    },
    fs: {
      strict: false // Helps with some module resolution issues
    }
  }
});