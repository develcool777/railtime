/** How `pnpm test-mutation` was asked to run, from its command line. */
export type MutationOptions = {
  /** The folders to run, from the repo root; none lists the folders that can be run. */
  paths: string[];
  /** Whether to retest everything, reusing nothing from the last run. */
  fresh: boolean;
  /** Whether to run every covering test against each mutant. */
  disableBail: boolean;
  /** How many test runners to start. */
  concurrency: number;
};

/** The Stryker options a run sets over the shared ones: what to mutate, which tests, where it writes. */
export type MutationTarget = {
  /** The files to break: each folder's code, less what is never mutated. */
  mutate: string[];
  /** The tests run against each mutant: each folder's own, mirroring it under `test/unit/`. */
  testFiles: string[];
  /** The target's results from its last run, so the next retests only what changed. */
  incrementalFile: string;
  /** Whether to retest every mutant, reusing nothing from the last run. */
  force: boolean;
  /** Whether every covering test runs against each mutant. */
  disableBail: boolean;
  /** How many test runners Stryker starts. */
  concurrency: number;
  /** The report to open. */
  htmlReporter: { fileName: string };
  /** The same report as data. */
  jsonReporter: { fileName: string };
};

/** One finished run, as the scores file keeps it. */
export type ScoreEntry = {
  /** The day it finished, `YYYY-MM-DD`. */
  date: string;
  /** Its mutation score, a percentage to one decimal; `null` when no mutant ran. */
  score: number | null;
  /** Mutants a test killed, or timed out on. */
  killed: number;
  /** Mutants a test ran against and did not notice. */
  survived: number;
  /** Mutants no test reached. */
  noCoverage: number;
  /** Whether it ran from scratch. */
  fresh: boolean;
};

/** The scores file: each target, as the command line names it, to its runs, oldest first. */
export type ScoreHistory = Record<string, ScoreEntry[]>;
