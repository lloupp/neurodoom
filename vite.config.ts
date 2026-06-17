import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, 'src/engine'),
      '@game': path.resolve(__dirname, 'src/game'),
      '@assets': path.resolve(__dirname, 'src/assets'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          engine: ['./src/engine/index.ts'],
          game: ['./src/game/index.ts'],
        },
      },
    },
  },
});
