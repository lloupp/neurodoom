import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, 'src/engine'),
      '@game': path.resolve(__dirname, 'src/game'),
    },
  },
});
