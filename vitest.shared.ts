import { globSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  setupFiles: [fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))],
} as const;

/**
 * Refuses to start while a test file has no source file to mirror: `test/unit/model/timeline.test.ts`
 * tests `src/model/timeline.*.ts`, so a test is found where its code is, and one left behind by a
 * rename or a delete is caught.
 *
 * @param root - The project's folder.
 * @param testDir - Its tests, relative to `root`.
 * @param sourceDir - The code they mirror, relative to `root`.
 */
export const assertTestsMirrorSource = (root: string, testDir: string, sourceDir: string): void => {
  const orphans = globSync('**/*.test.ts', { cwd: join(root, testDir) }).filter(
    testPath => globSync(`${testPath.replace(/\.test\.ts$/, '')}.*.ts`, { cwd: join(root, sourceDir) }).length === 0,
  );
  if (orphans.length > 0) {
    throw new Error(`A test mirrors the source file it tests; these have none in ${join(root, sourceDir)}:\n${orphans.join('\n')}`);
  }
};

/**
 * Refuses to start while a city's test has no city: `test/unit/cities/unitedKingdom/tyneAndWear.test.ts`
 * checks `cities/united-kingdom/tyne-and-wear/tyne-and-wear.json`.
 *
 * @param root - The data package's folder.
 */
export const assertTestsMirrorCities = (root: string): void => {
  const kebab = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  const orphans = globSync('*/*.test.ts', { cwd: join(root, 'test/unit/cities') }).filter(testPath => {
    const [country = '', city = ''] = testPath
      .replace(/\.test\.ts$/, '')
      .split('/')
      .map(kebab);
    return globSync(`${country}/${city}/${city}.json`, { cwd: join(root, 'cities') }).length === 0;
  });
  if (orphans.length > 0) throw new Error(`A city's test checks cities/<country>/<city>/<city>.json; these have none:\n${orphans.join('\n')}`);
};
