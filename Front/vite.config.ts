import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy de développement : /api/* -> http://localhost:3000/* (évite les soucis CORS)
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Fichiers générés par l'API (PDF de contrats…), servis hors du préfixe /api.
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Socket.io (présence en ligne, chat temps réel) : ws: true pour laisser
      // passer la montée en WebSocket.
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
