import { CONCURRENCY, DEFAULT_CONCURRENCY, DISABLE_BAIL, FRESH, NOT_MUTATED } from './target.constants.ts';
import type { MutationOptions, MutationTarget, ScoreEntry } from './target.types.ts';

/**
 * How `pnpm test-mutation` was asked to run.
 *
 * @param args - Its command-line arguments, after the script's own path.
 * @returns The folders and the flags.
 * @throws On a flag it does not know, rather than taking it for a folder; on a concurrency that is not a whole number.
 */
export const optionsOf = (args: string[]): MutationOptions => {
  const options: MutationOptions = { paths: [], fresh: false, disableBail: false, concurrency: DEFAULT_CONCURRENCY };
  for (const arg of args) {
    if (arg === FRESH) options.fresh = true;
    else if (arg === DISABLE_BAIL) options.disableBail = true;
    else if (arg.startsWith(CONCURRENCY)) {
      const value = arg.slice(CONCURRENCY.length);
      if (!/^[1-9]\d*$/.test(value)) throw new Error(`${CONCURRENCY}N takes a whole number of at least 1, not "${value}".`);
      options.concurrency = Number(value);
    } else if (arg.startsWith('--')) throw new Error(`No flag ${arg}: there are ${FRESH}, ${DISABLE_BAIL} and ${CONCURRENCY}N.`);
    else options.paths.push(arg);
  }
  return options;
};

/**
 * The code folder a path names: a package's `src/` or a folder in it, or `web/src/`'s.
 *
 * @param path - From the repo root: `packages/schema`, `packages/renderer/src/route`, `web/src/utils`.
 * @returns The folder, a package taken as its `src/`, without a leading `./` or a trailing `/`.
 * @throws If it is not in a package's or the web app's code.
 */
export const sourceDirOf = (path: string): string => {
  const dir = path
    .split('/')
    .filter(part => part !== '' && part !== '.')
    .join('/');
  if (/^packages\/[a-z-]+$/.test(dir)) return `${dir}/src`;
  if (/^(packages\/[a-z-]+|web)\/src(\/|$)/.test(dir)) return dir;
  throw new Error(`No code in ${dir}: give a package or a folder in its src/, from the repo root, e.g. packages/renderer/src/route.`);
};

/**
 * Where a code folder's own tests are: `src/` mirrored under `test/unit/`.
 *
 * @param dir - A code folder, from the repo root.
 * @returns Its tests' folder.
 */
export const testDirOf = (dir: string): string => dir.replace(/\/src(\/|$)/, '/test/unit$1');

/**
 * What a run mutates, which tests it runs, and where it writes: one report and one cache per target,
 * so a run on one folder leaves another's in place. Each folder's own tests only: another that happens
 * to cover the code would catch more, but every test of the package for each mutant is slow.
 *
 * @param dirs - The code folders, as {@link sourceDirOf} gives them.
 * @param options - The command line's flags.
 * @returns The Stryker options for them.
 */
export const targetOf = (dirs: string[], options: Omit<MutationOptions, 'paths'>): MutationTarget => {
  const { fresh, disableBail, concurrency } = options;
  const label = dirs.map(dir => dir.replaceAll('/', '-')).join('+');
  // In the web app only the plain helpers are tested here: its components are checked in the browser.
  const files = (dir: string) => (dir.startsWith('web/') ? `${dir}/**/*.utils.ts` : `${dir}/**/*.ts`);
  return {
    mutate: [...dirs.map(files), ...NOT_MUTATED.map(pattern => `!${pattern}`)],
    testFiles: dirs.map(dir => `${testDirOf(dir)}/**/*.test.ts`),
    incrementalFile: `test-reports/stryker-incremental/${label}${disableBail ? '.all-tests' : ''}.json`,
    force: fresh,
    disableBail,
    concurrency,
    htmlReporter: { fileName: `test-reports/mutation/${label}/index.html` },
    jsonReporter: { fileName: `test-reports/mutation/${label}/mutation.json` },
  };
};

/**
 * A finished run as the scores file keeps it. Its score is the share of the mutants that ran that a
 * test killed (or timed out on); one that survived, or that no test reached, is missed.
 *
 * @param statuses - Each mutant's status, as Stryker reports it.
 * @param fresh - Whether it ran from scratch.
 * @param date - The day it finished, `YYYY-MM-DD`.
 * @returns The entry.
 */
export const entryOf = (statuses: string[], fresh: boolean, date: string): ScoreEntry => {
  const count = (...wanted: string[]) => statuses.filter(status => wanted.includes(status)).length;
  const killed = count('Killed', 'Timeout');
  const survived = count('Survived');
  const noCoverage = count('NoCoverage');
  const ran = killed + survived + noCoverage;
  return { date, score: ran ? Math.round((killed / ran) * 1000) / 10 : null, killed, survived, noCoverage, fresh };
};
