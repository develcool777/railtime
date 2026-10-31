# CLAUDE.md

Guidance for Claude Code in this repository. The conventions follow `dataroom-ui`'s, and ESLint
enforces them: `pnpm eslint-check` must pass.

## What this is

A pnpm monorepo: `packages/schema` (the network format: `format/` its types, `validation/` the Zod
shape and the checks between parts, `plan/` building a plan on a network), `packages/renderer` (the MapLibre engine,
`TransitMap`), `packages/data` (every city's dataset in `cities/<country>/<city>/`, the index of them,
`cities/cities.json`, and `pnpm data:format`, which validates and tidies a dataset and rewrites the
index), `packages/tooling` (the repo's own tools: `pnpm test-mutation`) and `web` (the Nuxt 4 + Nuxt UI explorer).
`README.md` has the commands; `packages/renderer/_README.md` explains steps, cursors and the frame model.

## Checks

`pnpm type-check`, `pnpm test-unit-ci`, `pnpm eslint-check`, `pnpm format-check` and
`pnpm code-quality:dead-code` (knip) must all pass; CI runs them on every pull request.
After editing a city's dataset, run `pnpm data:format <city>`; after changing its track or lines'
colours, `pnpm data:previews <city>` too (it draws the landing page's pictures in Chrome).

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

- **The renderer has no UI.** Controls, captions and panels are Nuxt UI components in `web`;
  the renderer exposes methods and events (`transitMap.types.ts`) and never imports Vue.
- **Pure first.** `core/`, `network/`, `route/finder.service.ts`, `playback/` (but `camera.service.ts`),
  `steps/` and every `*.utils.ts` take no map: keep new logic there and test it (see Tests). A layer
  group is tested on the stand-in map (`test/support/factories/fakeMap.utils.ts`).
- **A folder per subject; files named for what they are, not the folder again**: `reach/layer.service.ts`
  (`ReachLayer`), `reach/layer.utils.ts`, `reach/layer.constants.ts`. Classes keep their full names.
- **A new kind of step** is a `StepAnimation` subclass plus one line in `createStepAnimation`.
- **A new group of map layers** is a `MapLayer` subclass installed by `TransitMap`.
- **The web app** follows the investors site's layout, in `web/src/`:

  ```text
  pages/  css/            routes, styles
  components/ui/          components every surface uses (SiteHeader, StatusChip, MapCredits…)
  constants/  utils/      the city catalogue (CITIES, city.utils): what any page needs
  features/<name>/        one product surface each: explorer (a city's map), landing (the city list),
                          seo; its components in components/, the rest flat beside them
  features/<name>/<part>/ a big feature in parts, as dataroom-ui's modules/fileRenderer: each part
                          (explorer's map/, time/, panel/, lines/…) its own components/ and files;
                          the feature's top holds the frame and what the parts share, and a
                          _README.md maps it
  ```

  Components are used by tag, never imported (`nuxt.config.ts` scans every `components/` under
  `features/`); anything else in a feature is imported by its path
  (`~/features/explorer/time/timeline.utils`), so what one feature or part takes from another can be
  searched for. In the explorer, a part never imports another part's composable: `ExplorerView`
  wires them, handing one's actions to another as callbacks.
  Something one surface uses goes in its feature; it moves to the top when a second needs it.

- Vue: `<script setup lang="ts">`, block order template → script → style, `props`/`emit` names,
  camelCase attributes and events.

## Tests

Each package keeps its tests beside its code, as dataroom-ui does inside its one app:

```text
packages/renderer/
  vitest.config.ts          the package's project (`pnpm --filter @railtime/renderer test-unit`)
  test/unit/                mirrors src/: test/unit/network/timeline.test.ts tests src/network/timeline.*.ts
  test/support/             what tests share: factories/ (tinyNetwork), playback.utils.ts
packages/data/
  test/unit/dataset/        mirrors src/dataset/
  test/unit/cities/         one test per city: unitedKingdom/london.test.ts checks
                            cities/united-kingdom/london/london.json, played through the renderer
web/test/unit/              mirrors web/src/ for its plain helpers (*.utils.ts); components are checked in the browser;
                            they import as the app does, from ~/, and test/support/ from @test/
```

- The renderer knows no city: its tests use made-up networks (`tinyNetwork`). A check of a city's
  history (the Victoria line's three stages, London's size today) goes in
  `packages/data/test/unit/cities/<country>/<city>.test.ts`.

- `pnpm test-unit` at the root runs every project (`vitest.config.ts`); options shared by all are in
  `vitest.shared.ts`: mocks reset between tests, random order, node.
- **Tests run the real code.** No `vi.mock` (ESLint): build the input with a factory in `test/support/`.
- A test mirrors one source file, or Vitest refuses to start; `*.test.ts` only in `test/unit/`,
  helpers only in `test/support/` (ESLint).
- `describe('<Module>')` (`Timeline`, `GrowthUtils`), a nested `describe` per function for a utils
  module, then `test('does what, when')`; never `it`.
- A `console.warn` or `console.error` during a test fails it (`vitest.setup.ts`).
- Coverage: `pnpm test-unit-coverage`, into `test-reports/coverage/`.
- Mutation testing, by hand, as in dataroom-ui: `pnpm test-mutation packages/renderer/src/route` has
  Stryker break the folder's code one small change at a time and run its own tests against each; a
  change no test notices is code run but not checked. The report is in `test-reports/mutation/`;
  each run's score goes in `test-reports/mutation-scores.json`, which is committed. With no folder,
  it lists the folders with their last scores. Coverage says a line ran; this says a test would fail
  if it were wrong.

## Data

`packages/data/cities/<country>/<city>/<city>.json` is the city's dataset and its source of truth: edit
it directly (a date, a station name), never regenerate it. `pnpm data:format <city>` validates it
against the schema, keeps its layout (one station or segment per line) and rewrites
`cities/cities.json`, the index the landing page reads; a test fails otherwise.
A segment's track starts and ends on its stations' coordinates, within 15 m (`STATION_GAP_METRES` in
`packages/schema/src/validation/checks.constants.ts`), or `data:format` refuses it: the line would miss the station's dot. Where an
interchange's lines run apart underground, each line's track ends at the one station point.
A station's `infill` on a line is dated once the line runs there (dated after the line has left, it
says the line never called there); its `closed` while the line runs there. `data:format` refuses
any other.

Each city's test lists every date a line comes apart (`lineSplits` in `test/support/history.utils.ts`),
with a comment saying why: a works closure, a stretch that opened on its own. A wrong date looks just
the same and fails the test: fix the date, or, if history really parted the line, add it with its reason.

There is no importer: London was imported from OpenStreetMap once and is curated from here. Its
dates are checked against Wikipedia's line, station and railway-company articles; a correction
goes in the dataset with that source in mind.
