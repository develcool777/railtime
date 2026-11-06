import { defineConfig } from 'vitest/config';

/**
 * Every project's tests in one run. Each package keeps its tests beside its code, in `test/`, with a
 * `vitest.config.ts` of its own (`pnpm --filter @railtime/renderer test-unit` runs one), `packages/data`
 * among them: each city's history played through the renderer; and `web/` its own, which each take
 * their projects from `projectsOf`, so a file's name picks its environment in all of them.
 */
export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts', 'web/vitest.config.ts'],
    coverage: {
      provider: 'v8',
      // Every test tool writes under `test-reports/`: one folder to look in, and one to ignore.
      reportsDirectory: 'test-reports/coverage',
      // Every file of the code, loaded by a test or not; types have no behaviour to cover.
      include: ['packages/*/src/**', 'web/src/**/*.utils.ts'],
      exclude: ['**/*.types.ts', '**/*.constants.ts', '**/cli.*.ts'],
    },
  },
});
