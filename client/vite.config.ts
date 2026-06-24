import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dentro de Docker el backend es http://server:4000; en local, http://localhost:4000.
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // expone el dev server fuera del contenedor
    proxy: {
      // Reenvía /api al backend Express en desarrollo.
      '/api': proxyTarget,
    },
  },
});
