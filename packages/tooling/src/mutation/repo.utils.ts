import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SCORES_FILE } from './target.constants.ts';
import type { ScoreEntry, ScoreHistory } from './target.types.ts';
import { testDirOf } from './target.utils.ts';

/**
 * Every run so far, from the scores file.
 *
 * @param root - The repo root.
 * @returns Each target's runs, oldest first; none before the first.
 */
export const readScores = (root: string): ScoreHistory => {
  const file = join(root, SCORES_FILE);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as ScoreHistory) : {};
};

/**
 * Adds a finished run to the scores file, after the target's earlier ones.
 *
 * @param root - The repo root.
 * @param target - The target, as the command line named it: `packages/schema/src packages/renderer/src/core`.
 * @param entry - The run.
 */
export const recordScore = (root: string, target: string, entry: ScoreEntry): void => {
  const history = readScores(root);
  history[target] = [...(history[target] ?? []), entry];
  // Targets in order, so a run moves one line of the diff rather than the file.
  const sorted = Object.fromEntries(Object.entries(history).sort(([first], [second]) => first.localeCompare(second)));
  const file = join(root, SCORES_FILE);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
};

/**
 * The code folders a run can take: each package's `src/`, and every folder in one with tests of its own.
 *
 * @param root - The repo root.
 * @returns Their paths from the repo root, alphabetically.
 */
export const testedFolders = (root: string): string[] =>
  globSync(['packages/*/src', 'packages/*/src/*/'], { cwd: root })
    .filter(dir => existsSync(join(root, testDirOf(dir))))
    .sort((first, second) => first.localeCompare(second));
