import { globSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestProjectInlineConfiguration } from 'vitest/config';

/**
 * What every project's tests run with, as in dataroom-ui: every mock and stubbed global is reset
 * between tests, and tests run in random order, so one cannot lean on what another left behind.
 * The setup fails a test that logs a warning or an error it did not expect.
 */
export const SHARED_TEST_OPTIONS = {
  environment: 'node',
  mockReset: true,
  restoreMocks: true,
  unstubGlobals: true,
  unstubEnvs: true,
  sequence: { shuffle: true },
  setupFiles: [fileURLToPath(new URL('vitest.setup.ts', import.meta.url))],
} as const;

/**
 * A package's projects, as in dataroom-ui, where a test file's name picks its environment: a
 * `*.test.ts` runs in node, a `*.spec.ts` in happy-dom, for code that makes elements of its own
 * (an inset over the map, a hidden container). Each is a project of its own.
 *
 * @param name - The package's project name; its specs' is `<name>-dom`.
 * @param extra - What the package's tests run with besides: how it resolves its imports, its benchmarks.
 * @returns The two projects.
 */
export const projectsOf = (name: string, extra: TestProjectInlineConfiguration = {}): TestProjectInlineConfiguration[] => [
  { ...extra, test: { ...extra.test, ...SHARED_TEST_OPTIONS, name, include: ['test/unit/**/*.test.ts'] } },
  // A benchmark is timed in node, where the work runs: it has no elements of its own.
  {
    ...extra,
    test: {
      ...extra.test,
      ...SHARED_TEST_OPTIONS,
      name: `${name}-dom`,
      environment: 'happy-dom',
      include: ['test/unit/**/*.spec.ts'],
      benchmark: { include: [] },
    },
  },
];

/**
 * A camelCase name in kebab case: `tyneAndWear` as `tyne-and-wear`.
 *
 * @param name - The name.
 * @returns It, in kebab case.
 */
const kebab = (name: string): string => name.replaceAll(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/**
 * Refuses to start while a city's test has no city: `test/unit/cities/unitedKingdom/tyneAndWear.test.ts`
 * checks `cities/united-kingdom/tyne-and-wear/tyne-and-wear.json`.
 *
 * @param root - The data package's folder.
 */
export const assertTestsMirrorCities = (root: string): void => {
  const orphans = globSync('*/*.test.ts', { cwd: join(root, 'test/unit/cities') }).filter(testPath => {
    const [country = '', city = ''] = testPath
      .replace(/\.test\.ts$/, '')
      .split('/')
      .map(kebab);
    return globSync(`${country}/${city}/${city}.json`, { cwd: join(root, 'cities') }).length === 0;
  });
  if (orphans.length > 0) throw new Error(`A city's test checks cities/<country>/<city>/<city>.json; these have none:\n${orphans.join('\n')}`);
};
