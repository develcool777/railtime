# @railtime/tooling

The repo's own tools: the house's lint rules, which read types, and `pnpm test-mutation`. Nothing here
ships; nothing in `src/` of another package imports it.

## The house's lint rules (`src/lint/`)

The conventions in `../../CLAUDE.md` that no plugin's rule can check, each a typed rule
(`@typescript-eslint/utils`), tested with its own cases in `test/unit/lint/`. `eslint/shared.js` gathers
them under the `house` plugin, and each `eslint/*.config.js` turns on its own:

| rule                        | file                      | holds                                                            |
| --------------------------- | ------------------------- | ---------------------------------------------------------------- |
| `house/bounded-assertion`   | `assertionRules.utils.ts` | a `!` only on an index a loop's head bounds, with its comment    |
| `house/checked-ids`         | `idRules.utils.ts`        | a string made an id only where it is checked                     |
| `house/branded-spread-key`  | `idRules.utils.ts`        | no id key beside a spread, which TypeScript checks nothing under |
| `house/branded-record-keys` | `idRules.utils.ts`        | a record keyed by ids walked with `keysOf`/`entriesOf`           |
| `house/served-files`        | `idRules.utils.ts`        | a city's file typed only at its door (`@railtime/schema`)        |
| `house/store-returns-state` | `storeRules.utils.ts`     | a setup store returns all its state                              |
| `house/store-shape`         | `storeRules.utils.ts`     | a store's headings, their order, its actions' capitals           |
| `house/mirrored-tests`      | `fileRules.utils.ts`      | a test and its source file named for each other, both ways       |

Two more, `house/pure-utils` and `house/test-helpers`, are `no-restricted-imports` under a name of their
own (`eslint/shared.js`). A rule's link in a report points at its convention in CLAUDE.md (`rule.utils.ts`).

## Mutation testing (`src/cli.mutation.ts`, `src/mutation/`)

`pnpm test-mutation <folder>…` runs Stryker over the folders named, against their tests (a `src/`
folder's mirror in `test/unit/`), and adds the score to `test-reports/mutation-scores.json`, which is
committed. With no folder, it lists those it can run with their last scores. Its options and the
report's place are at the top of `cli.mutation.ts`.

## Traps

- **It runs as Node runs TypeScript**: types stripped, nothing compiled. Erasable syntax only, and a
  runtime import names its file, `.ts` included. ESLint loads the rules the same way.
- **The Stryker patch** (`patches/@stryker-mutator__core@10.1.1.patch`) switches static mutants on before
  any test imports their module (stryker-js#6144). Drop it once a release has the fix.
