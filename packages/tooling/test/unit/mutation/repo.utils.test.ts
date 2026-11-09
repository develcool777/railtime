import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { readScores, recordScore, testedFolders } from '../../../src/mutation/repo.utils';
import type { ScoreEntry } from '../../../src/mutation/target.types';

/** A run's entry, on a day. */
const run = (date: string, score: number): ScoreEntry => ({ date, score, killed: 1, survived: 0, noCoverage: 0, fresh: false });

describe('RepoUtils', () => {
  let root = '';
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'railtime-mutation-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  describe('readScores and recordScore', () => {
    test("reads none before the first run, then adds each after the target's earlier ones, targets in order", () => {
      expect(readScores(root)).toEqual({});
      recordScore(root, 'packages/schema/src', run('2026-10-30', 90));
      recordScore(root, 'packages/renderer/src/core', run('2026-10-30', 80));
      recordScore(root, 'packages/schema/src', run('2026-10-31', 95));
      expect(readScores(root)).toEqual({
        'packages/renderer/src/core': [run('2026-10-30', 80)],
        'packages/schema/src': [run('2026-10-30', 90), run('2026-10-31', 95)],
      });
      expect(Object.keys(JSON.parse(readFileSync(join(root, 'test-reports/mutation-scores.json'), 'utf8')))).toEqual([
        'packages/renderer/src/core',
        'packages/schema/src',
      ]);
    });
  });

  describe('testedFolders', () => {
    test("lists each package's src/ and its folders that have tests of their own, in order, from the root given", () => {
      // Named apart from the repo's own packages, so a list of the repo's folders shows.
      for (const dir of ['packages/alpha/src/core', 'packages/alpha/src/plan', 'packages/alpha/test/unit/core', 'packages/beta/src', 'packages/beta/test/unit'])
        mkdirSync(join(root, dir), { recursive: true });
      expect(testedFolders(root)).toEqual(['packages/alpha/src', 'packages/alpha/src/core', 'packages/beta/src']);
    });
  });
});
