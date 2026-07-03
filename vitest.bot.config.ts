import { defineConfig } from 'vite';

/** `npm run bot` — the balance sweep harness (not part of CI `npm test`). */
export default defineConfig({
  test: {
    include: ['bot/**/*.sweep.ts'],
    environment: 'node',
    testTimeout: 600_000,
  },
});
