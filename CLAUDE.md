# CLAUDE.md

Guidance for Claude Code in this repository. The conventions follow `dataroom-ui`'s, and ESLint
enforces them: `pnpm eslint-check` must pass.

## What this is

A pnpm monorepo: `packages/schema` (the network format), `packages/renderer` (the MapLibre engine,
`TransitMap`), `apps/web` (the Nuxt 4 + Nuxt UI explorer) and `scripts/` (`pnpm data:format`, which validates and tidies a city's dataset).
`README.md` has the commands; `packages/renderer/_README.md` explains steps, cursors and the frame model.

## Checks

`pnpm type-check`, `pnpm test-unit-ci`, `pnpm eslint-check`, `pnpm format-check` and
`pnpm code-quality:dead-code` (knip) must all pass; CI runs them on every pull request.
After editing `data/<city>/<city>.json`, run `pnpm data:format <city>`.

## Conventions (enforced)

- **Arrow functions only.** `const name = (…): Type => …`; no `function`, declaration or expression.
- **Loops say what they loop over.** No `for (;;)` or `while (true)`.
- **Classes live in `*.service.ts`**, one role per file: helpers in `*.utils.ts`, constants in
  `*.constants.ts`, types in `*.types.ts` beside their file (`player.types.ts` next to
  `player.service.ts`). No `types/` folders, no barrels.
- **Every class member has an access modifier** (`public`, `protected`, `private`), and every class,
  member, exported function, constant and type has a JSDoc comment.
- **Names say what they hold**: three letters at least, but for `id`, `x`, `y`, `km`, `on`, `to`.
- **Strict indexing** (`noUncheckedIndexedAccess`): a lookup by an id the network supplied goes
  through `required()` (or `NetworkIndex.stationOf`/`lineOf`), which fails loudly; `!` only inside a
  loop whose bounds guarantee the element, with a comment saying so.
- **Erasable TypeScript only** (`erasableSyntaxOnly`): scripts run directly under Node's type
  stripping, so no enums or constructor parameter properties.

## Architecture

- **The renderer has no UI.** Controls, captions and panels are Nuxt UI components in `apps/web`;
  the renderer exposes methods and events (`transitMap.types.ts`) and never imports Vue.
- **Pure first.** `model/`, `playback/` (but `camera.service.ts`), `steps/` and
  `layers/networkSnapshot.utils.ts` take no map: keep new logic there and test it (see Tests).
- **A new kind of step** is a `StepAnimation` subclass plus one line in `createStepAnimation`.
- **A new group of map layers** is a `MapLayer` subclass installed by `TransitMap`.
- Vue: `<script setup lang="ts">`, block order template → script → style, `props`/`emit` names,
  camelCase attributes and events.

## Tests

Each package keeps its tests beside its code, as dataroom-ui does inside its one app:

```text
packages/renderer/
  vitest.config.ts          the package's project (`pnpm --filter @railtime/renderer test-unit`)
  test/unit/                mirrors src/: test/unit/model/timeline.test.ts tests src/model/timeline.*.ts
  test/support/             what tests share: factories/ (tinyNetwork), fixtures/ (london), playback.utils.ts
scripts/test/unit/          mirrors scripts/; its project is in the root vitest.config.ts
```

- `pnpm test-unit` at the root runs every project (`vitest.config.ts`); options shared by all are in
  `vitest.shared.ts`: mocks reset between tests, random order, node.
- **Tests run the real code.** No `vi.mock` (ESLint): build the input with a factory in `test/support/`.
- A test mirrors one source file, or Vitest refuses to start; `*.test.ts` only in `test/unit/`,
  helpers only in `test/support/` (ESLint).
- `describe('<Module>')` (`Timeline`, `GrowthUtils`), a nested `describe` per function for a utils
  module, then `test('does what, when')`; never `it`.
- A `console.warn` or `console.error` during a test fails it (`vitest.setup.ts`).
- Coverage: `pnpm test-unit-coverage`, into `test-reports/coverage/`.

## Data

`data/<city>/<city>.json` is the city's dataset and its source of truth: edit it directly (a date,
a station name), never regenerate it. `pnpm data:format <city>` validates it against the schema and
keeps its layout (one station or segment per line); a test fails otherwise.

There is no importer: London was imported from OpenStreetMap once and is curated from here. Its
dates are checked against Wikipedia's line, station and railway-company articles; a correction
goes in the dataset with that source in mind.
