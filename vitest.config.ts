import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { SHARED_TEST_OPTIONS, assertTestsMirrorSource } from './vitest.shared.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assertTestsMirrorSource(ROOT, 'web/test/unit', 'web/src');

/**
 * Every project's tests in one run. Each package keeps its tests beside its code, in `test/`, with a
 * `vitest.config.ts` of its own (`pnpm --filter @railtime/renderer test-unit` runs one), `packages/data`
 * among them: each city's history played through the renderer. One is defined here: `web/`'s plain
 * helpers (`web/test/unit/` mirrors `web/src/`), which import it as Nuxt does, from `~/`, and their factories from `@test/`.
 */
export default defineConfig({
  test: {
    projects: [
      'packages/*/vitest.config.ts',
      {
        resolve: { alias: { '~': `${ROOT}web/src`, '@test': `${ROOT}web/test` } },
        test: { ...SHARED_TEST_OPTIONS, name: 'web', include: ['web/test/unit/**/*.test.ts'] },
      },
    ],
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
