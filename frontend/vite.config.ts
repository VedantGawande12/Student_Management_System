import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = 'https://student-management-system-d6wy.onrender.com';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: true
      }
    }
  },
  preview: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: true
      }
    }
  }
});
