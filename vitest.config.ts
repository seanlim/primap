import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      include: [
        'lib/**/*.ts',
        'lib/**/*.tsx',
        'middleware.ts',
        'app/api/**/*.ts',
        'app/(auth)/**/*.ts',
      ],
      exclude: [
        'lib/types/**',
        'lib/supabase/client.ts',
        'lib/supabase/server.ts',
        'lib/supabase/admin.ts',
        'lib/config/onemap.tsx',
      ],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
})
