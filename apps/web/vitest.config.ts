import path from 'node:path';
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    // *.integration.test.ts hits the real DB in DATABASE_URL — run those
    // separately via `npm run test:integration` (see vitest.integration.config.ts),
    // not as part of this DB-independent default suite.
    exclude: [...defaultExclude, '**/*.integration.test.ts', 'e2e/**'],
  },
});
