import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests run against the core's TypeScript source so no core build is needed.
export default defineConfig({
  resolve: {
    alias: {
      '@donega/form-wrapper': fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
