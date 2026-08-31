import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Separate from vitest.config.ts on purpose: these tests hit the real
// Postgres in DATABASE_URL (run via `npm run test:integration`, which loads
// .env.local first — see package.json). Kept out of the default `npm test`
// run so CI/dev environments without a reachable DB still get a green
// typecheck/lint/test/build gate.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only' throws on import outside Next's bundler (its default
      // export condition is an unconditional throw; only the 'react-server'
      // condition resolves to a no-op). Point straight at that no-op so
      // files importing 'server-only' load under plain Node/vitest.
      'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 15000,
  },
});
