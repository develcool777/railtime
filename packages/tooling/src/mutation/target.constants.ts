/**
 * Every run's score, by target, oldest first. The one file in `test-reports/` that is committed: a
 * report is local and only a target's last is kept, while the history is shared.
 */
export const SCORES_FILE = 'test-reports/mutation-scores.json';

/** The flag to retest every mutant, reusing nothing from the last run: after Stryker or its patch changes, which a rerun cannot see. */
export const FRESH = '--fresh';

/**
 * The flag to run every test that covers a mutant against it, not only up to the first that fails, so
 * the report lists every test that kills each one. Several times slower; cached apart from an ordinary run.
 */
export const DISABLE_BAIL = '--disable-bail';

/** The flag for how many test runners a run starts: `--concurrency=8`. */
export const CONCURRENCY = '--concurrency=';

/** Never mutated, as coverage leaves them out: types have no behaviour, constants are data, a command only wires the rest. */
export const NOT_MUTATED = ['**/*.types.ts', '**/*.constants.ts', '**/cli.*.ts'];

/** How many test runners a run starts unless told. */
export const DEFAULT_CONCURRENCY = 6;
