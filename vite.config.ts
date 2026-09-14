import { defineConfig } from 'vite';
import path from 'node:path';

// Cloudflare Tunnel / ngrok access requires host-open config
const dir = typeof import.meta.dirname !== 'undefined'
  ? import.meta.dirname
  : (path.resolve(new URL('.', import.meta.url).pathname) || '/home/ubuntu/neurodoom');

const base = process.env.GITHUB_PAGES === 'true' ? '/neurodoom/' : '/';

export default defineConfig({
  base,
  resolve: {
    alias: {
      '@engine': path.resolve(dir, 'src/engine'),
      '@game': path.resolve(dir, 'src/game'),
      '@assets': path.resolve(dir, 'src/assets'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    allowedHosts: true,
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
