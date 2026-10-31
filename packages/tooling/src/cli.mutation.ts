// Mutation testing, one part of the code at a time, as in dataroom-ui: Stryker breaks the code on
// purpose, one small change at a time (a condition flipped, a `-` made a `+`), and runs the folder's
// tests against each change. A change no test notices is a gap: the code is run, but not checked.
//
//   pnpm test-mutation                                   # the folders it can run, with each one's last score
//   pnpm test-mutation packages/renderer/src/route       # against packages/renderer/test/unit/route
//   pnpm test-mutation packages/schema                   # a whole package
//   pnpm test-mutation packages/schema/src/plan packages/schema/src/core   # both, against both folders' tests
//   pnpm test-mutation packages/schema --fresh           # reuse nothing from the last run
//   pnpm test-mutation packages/schema --disable-bail    # every test against every mutant
//   pnpm test-mutation packages/renderer --concurrency=8 # more test runners
//
// The report: test-reports/mutation/<folder with - for />/index.html. A rerun retests only what changed
// since the last; a run stopped by Ctrl+C saves what it tested. Every finished run adds its score to
// test-reports/mutation-scores.json, which is committed.
import { Stryker } from '@stryker-mutator/core';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readScores, recordScore, testedFolders } from './mutation/repo.utils.ts';
import { entryOf, optionsOf, sourceDirOf, targetOf, testDirOf } from './mutation/target.utils.ts';

const root = process.cwd();
const options = optionsOf(process.argv.slice(2));

if (options.paths.length === 0) {
  const scores = readScores(root);
  console.log('Name one or more folders, e.g. pnpm test-mutation packages/renderer/src/route. Each one, with its last score:\n');
  for (const dir of testedFolders(root)) {
    const last = scores[dir]?.at(-1);
    const lastRun = last ? `${last.score ?? '-'}% · ${last.date}` : 'not run yet';
    console.log(`  ${dir.padEnd(40)} ${lastRun}`);
  }
  process.exit(0);
}

const dirs = options.paths.map(sourceDirOf);
for (const dir of dirs) {
  if (!existsSync(dir)) throw new Error(`No folder ${dir}.`);
  if (!existsSync(testDirOf(dir))) throw new Error(`No tests in ${testDirOf(dir)}: every mutant would survive.`);
}
const target = targetOf(dirs, options);
const stryker = new Stryker({
  // Found from this package, where pnpm installed it, though the run starts at the repo root.
  plugins: [fileURLToPath(import.meta.resolve('@stryker-mutator/vitest-runner'))],
  testRunner: 'vitest',
  // The root config runs every project, so a folder's tests run as `pnpm test-unit` runs them.
  vitest: { configFile: 'vitest.config.ts' },
  coverageAnalysis: 'perTest',
  incremental: true,
  reporters: ['clear-text', 'progress', 'html', 'json'],
  timeoutMS: 20000,
  thresholds: { high: 80, low: 60, break: null },
  cleanTempDir: 'always',
  ...target,
});
const entry = entryOf(
  (await stryker.runMutationTest()).map(result => result.status),
  target.force,
  // `en-CA` writes a date as YYYY-MM-DD, in the local time zone.
  new Date().toLocaleDateString('en-CA'),
);
recordScore(root, dirs.join(' '), entry);
console.log(`\n${dirs.join(' ')}: ${entry.score ?? '-'}% (${entry.survived} survived, ${entry.noCoverage} not covered) · ${target.htmlReporter.fileName}`);
