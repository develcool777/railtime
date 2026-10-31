import { describe, expect, test } from 'vitest';
import { entryOf, optionsOf, sourceDirOf, targetOf, testDirOf } from '../../../src/mutation/target.utils';

describe('TargetUtils', () => {
  describe('optionsOf', () => {
    test('takes folders and flags in any order, six test runners unless told', () => {
      expect(optionsOf(['packages/schema', '--fresh', 'packages/renderer/src/core', '--disable-bail', '--concurrency=8'])).toEqual({
        paths: ['packages/schema', 'packages/renderer/src/core'],
        fresh: true,
        disableBail: true,
        concurrency: 8,
      });
      expect(optionsOf([])).toEqual({ paths: [], fresh: false, disableBail: false, concurrency: 6 });
    });

    test('refuses a flag it does not know, and a concurrency that is not a whole number of at least 1', () => {
      expect(() => optionsOf(['--fast'])).toThrow('No flag --fast: there are --fresh, --disable-bail and --concurrency=N.');
      expect(() => optionsOf(['--concurrency=0'])).toThrow('--concurrency=N takes a whole number of at least 1, not "0".');
      expect(() => optionsOf(['--concurrency=two'])).toThrow('not "two"');
      expect(() => optionsOf(['--concurrency=8x'])).toThrow('not "8x"');
      expect(() => optionsOf(['--concurrency=1x'])).toThrow('not "1x"');
      expect(() => optionsOf(['--concurrency=x1'])).toThrow('not "x1"');
    });
  });

  describe('sourceDirOf', () => {
    test("takes a package as its src/, and a folder in a package's or the web app's src/ as it is", () => {
      expect(sourceDirOf('packages/schema')).toBe('packages/schema/src');
      expect(sourceDirOf('./packages/renderer/src/route/')).toBe('packages/renderer/src/route');
      expect(sourceDirOf('packages/schema/src')).toBe('packages/schema/src');
      expect(sourceDirOf('web/src/utils')).toBe('web/src/utils');
    });

    test('refuses a path outside the code', () => {
      expect(() => sourceDirOf('packages/schema/test/unit')).toThrow('No code in packages/schema/test/unit');
      expect(() => sourceDirOf('web')).toThrow('No code in web');
      expect(() => sourceDirOf('src/route')).toThrow('No code in src/route');
      expect(() => sourceDirOf('old/packages/schema')).toThrow('No code in old/packages/schema');
      expect(() => sourceDirOf('old/web/src/utils')).toThrow('No code in old/web/src/utils');
    });
  });

  describe('testDirOf', () => {
    test('mirrors src/ under test/unit/, the top of it too', () => {
      expect(testDirOf('packages/renderer/src/route')).toBe('packages/renderer/test/unit/route');
      expect(testDirOf('packages/schema/src')).toBe('packages/schema/test/unit');
      expect(testDirOf('web/src/utils')).toBe('web/test/unit/utils');
    });
  });

  describe('targetOf', () => {
    test("mutates each folder's code against its own tests, with a report and a cache of its own", () => {
      expect(targetOf(['packages/schema/src/plan', 'packages/schema/src/core'], { fresh: true, disableBail: false, concurrency: 4 })).toEqual({
        mutate: ['packages/schema/src/plan/**/*.ts', 'packages/schema/src/core/**/*.ts', '!**/*.types.ts', '!**/*.constants.ts', '!**/cli.*.ts'],
        testFiles: ['packages/schema/test/unit/plan/**/*.test.ts', 'packages/schema/test/unit/core/**/*.test.ts'],
        incrementalFile: 'test-reports/stryker-incremental/packages-schema-src-plan+packages-schema-src-core.json',
        force: true,
        disableBail: false,
        concurrency: 4,
        htmlReporter: { fileName: 'test-reports/mutation/packages-schema-src-plan+packages-schema-src-core/index.html' },
        jsonReporter: { fileName: 'test-reports/mutation/packages-schema-src-plan+packages-schema-src-core/mutation.json' },
      });
    });

    test("keeps every test's run apart from an ordinary one, and mutates only the web app's plain helpers", () => {
      const target = targetOf(['web/src/utils'], { fresh: false, disableBail: true, concurrency: 6 });
      expect(target.incrementalFile).toBe('test-reports/stryker-incremental/web-src-utils.all-tests.json');
      expect(target.mutate[0]).toBe('web/src/utils/**/*.utils.ts');
    });
  });

  describe('entryOf', () => {
    test('scores the share of the mutants that ran a test caught, a timeout as caught', () => {
      expect(entryOf(['Killed', 'Timeout', 'Killed', 'Survived', 'NoCoverage', 'Ignored', 'CompileError'], false, '2026-10-31')).toEqual({
        date: '2026-10-31',
        score: 60,
        killed: 3,
        survived: 1,
        noCoverage: 1,
        fresh: false,
      });
    });

    test('rounds to one decimal, and has no score when no mutant ran', () => {
      expect(entryOf(['Killed', 'Killed', 'Survived'], true, '2026-10-31').score).toBeCloseTo(66.7, 5);
      expect(entryOf(['Ignored'], true, '2026-10-31').score).toBeNull();
    });
  });
});
