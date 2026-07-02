/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play/index.html'),
      },
    },
  },
  server: {
    port: 5199,
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
