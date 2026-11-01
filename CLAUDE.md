# CLAUDE.md

Guidance for Claude Code in this repository. The conventions follow `dataroom-ui`'s, and ESLint
enforces them: `pnpm eslint-check` must pass.

## What this is

A pnpm monorepo, a job to each part (`ARCHITECTURE.md`): `packages/core` (helpers about nothing in
rail, used by more than one package: dates, geometry, `required`; a helper is never copied, it moves
here), `packages/schema` (the format: `format/` its
types, `validation/` the Zod shape and the checks between parts, `plan/` building a plan on a network),
`packages/network` (the facts: `NetworkFacts` for everyone, every answer about the network, its history
and its plans; `NetworkEngine`, `facts.engine`, the raw network the renderer plays and draws),
`packages/renderer` (drawing: the MapLibre engine, `TransitMap`), `packages/data` (storage: every
city's files in `cities/<country>/<city>/`, its network `<city>.json`, outline and pictures; the index
of them, `cities/cities.json`; and the commands that keep them, a folder each in `src/`: `summary/`,
`boundary/`, `preview/`), `packages/tooling` (the repo's own tools: `pnpm test-mutation`) and `web`
(the app: the Nuxt 4 + Nuxt UI explorer).
`README.md` has the commands; `ARCHITECTURE.md` the contract between the parts;
`packages/network/_README.md` steps and cursors; `packages/renderer/_README.md` the frame model.

## Checks

`pnpm type-check`, `pnpm test-unit-ci`, `pnpm eslint-check`, `pnpm format-check` and
`pnpm code-quality:dead-code` (knip) must all pass; CI runs them on every pull request.
After adding a city or changing one's lines, stations or plans, run `pnpm data:summaries` (the landing
page's list); after changing its track or lines' colours, `pnpm data:previews <city>` too (it draws the
landing page's pictures in Chrome).

## Conventions (enforced)

- **Arrow functions only.** `const name = (…): Type => …`; no `function`, declaration or expression.
- **Loops say what they loop over.** No `for (;;)` or `while (true)`.
- **Classes live in `*.service.ts`**, helpers in `*.utils.ts`; a file may hold several classes of
  one subject (a base and its kinds). Types and constants keep files of their own, beside the code
  they belong to (`camera.types.ts` next to `camera.service.ts`): when code merges, its types and
  constants merge into the merged file's. No `types/` folders, no barrels. No file passes ~500
  lines: a subject that big splits by job, never by role.
- **Every class member has an access modifier** (`public`, `protected`, `private`), and every class,
  member, exported function, constant and type has a JSDoc comment.
- **Names say what they hold**: three letters at least, but for `id`, `x`, `y`, `km`, `on`, `to`.
- **Strict indexing** (`noUncheckedIndexedAccess`): a lookup by an id the network supplied goes
  through `required()` (or `NetworkIndex.stationOf`/`lineOf`), which fails loudly; `!` only inside a
  loop whose bounds guarantee the element, with a comment saying so.
- **A command is a feature's `cli.ts`** (`packages/data/src/boundary/cli.ts`, `pnpm data:boundary`): it
  reads its arguments, calls the feature in a `try`, and on an error says it and sets
  `process.exitCode = 1`. The feature knows nothing of the command: it takes typed arguments, throws
  what went wrong, and closes what it opened. A function in the feature's utils, or a service where it
  holds state (`PreviewRenderer`: a server, Chrome, a page); beside it one types and one constants file.
- **Erasable TypeScript only** (`erasableSyntaxOnly`): scripts run directly under Node's type
  stripping, so no enums or constructor parameter properties; and in the code they run (`core`,
  `schema`, `network`, `data/src`) a runtime import names its file, `.ts` included (ESLint).
- **A package through its door**: another package is imported by its `exports` (`@railtime/<package>/…`),
  never by a path into its folders (ESLint); what its tests share, from `@railtime/<package>/testing/…`.

## Architecture

- **A fact is `network`'s.** A count, a length, a station's neighbours, a route, a caption: a method
  on `NetworkFacts` (or the `FactsAt` its `asOf` gives), tested in `packages/network`; `web` and `data`
  ask it, never work it out, and never import its `engine.*` (`NetworkEngine`, ESLint), which is the renderer's. No
  answer takes a theme: a line's colour is a `LineColor` in both, and what shows it picks one. `web` keeps presentation: formatting, grouping, the search.
- **The renderer has no UI and no facts.** Controls, captions and panels are Nuxt UI components in
  `web`; the renderer takes props, commands and listeners (`transitMap.types.ts`, `ARCHITECTURE.md`)
  and never imports Vue. A setting it shows is a prop, never a `setX` method.
- **Pure first.** All of `packages/network`, the renderer's player, `steps/` and every `*.utils.ts`
  take no map: keep new logic there and test it (see Tests). A layer
  group is tested on the stand-in map (`test/support/factories/fakeMap.utils.ts`), which refuses what
  MapLibre would: a layer the style spec does not allow, data that is not GeoJSON features, and a
  layer reading (`['get', name]`) a property no feature of its source has.
- **A folder per subject, of two files or more** (a single file joins the nearest subject's folder);
  files named for what they are, not the folder again (`overlay/route.service.ts`, `RouteLayer`),
  but for the folder's main class and its one shared types, constants or utils file, which take
  its name (`engine/engine.service.ts`, `overlay/overlay.utils.ts`). Classes keep their full names.
- **A new kind of step** is its times in `STEP_TIMES` and a case in `StepAnimation`'s `cameraPoints`
  and `draw` (`steps/animation.service.ts`): one class for every kind, its pure parts in
  `animation.utils.ts`.
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
  searched for. In the explorer, a part never imports another part's composable: what parts share
  is in the store. A composable earns a file of its own by holding effects (a fetch, a listener, the
  map); what the panel shows, computed over the store, is `panel/panel.composable.ts`.
  Something one surface uses goes in its feature; it moves to the top when a second needs it.
  The explorer's state (what is open, how it is set) is one Pinia store, `explorer.store.ts`: every
  button calls its actions, and its rules are pure functions in `explorer.utils.ts`; its `mapProps` is
  everything the map shows, and `map/transitMap.composable.ts` is the only code that touches the map.
  What is looked at goes in the address, preferences in cookies (`features/explorer/_README.md`).

- Vue: `<script setup lang="ts">`, block order template → script → style, `props`/`emit` names,
  camelCase attributes and events.

## Tests

Each package keeps its tests beside its code, as dataroom-ui does inside its one app:

```text
packages/network/
  vitest.config.ts          the package's project (`pnpm --filter @railtime/network test-unit`)
  test/unit/                mirrors src/: test/unit/engine/timeline.test.ts tests src/engine/timeline.*.ts
  test/support/             what tests share: factories/ (tinyNetwork, planOnlyNetwork, boundaries:
                            exported as `@railtime/network/testing/*` for the other packages' tests), facts.utils.ts
packages/renderer/
  test/unit/                mirrors src/, as network's; transitMap.test.ts tests the contract whole
  test/support/             fakeMap, playback.utils.ts (a player wired as the map wires it, and what
                            the map draws: `@railtime/renderer/testing/playback` for data's city tests)
packages/data/
  test/unit/<feature>/      mirrors src/<feature>/: city/ (finding the cities and reading their files),
                            format/, boundary/, preview/ (a command each)
  test/unit/cities/         one test per city: unitedKingdom/london.test.ts checks
                            cities/united-kingdom/london/london.json, played through the renderer
web/test/unit/              mirrors web/src/ for its plain helpers (*.utils.ts); components are checked in the browser;
                            they import as the app does, from ~/, and test/support/ from @test/
```

- `network` and the renderer know no city: their tests use made-up networks (`tinyNetwork`). A check of a city's
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
- Mutation testing, by hand, as in dataroom-ui: `pnpm test-mutation packages/network/src/route` has
  Stryker break the folder's code one small change at a time and run its own tests against each; a
  change no test notices is code run but not checked. The report is in `test-reports/mutation/`;
  each run's score goes in `test-reports/mutation-scores.json`, which is committed. With no folder,
  it lists the folders with their last scores. Coverage says a line ran; this says a test would fail
  if it were wrong. A rerun reuses what it can: after adding tests for code that runs as its module
  loads (a Zod schema, a constant built from others), run with `--fresh`, or those mutants keep their
  old result. A survivor that changes nothing (`i >= 0` where `i > 0` and `list[-1]` is `undefined`)
  or only how the map looks (a halo width) is left; one that changes behaviour gets a test.

## Data

`packages/data/cities/<country>/<city>/<city>.json` is the city's network and its source of truth: edit
it directly (a date, a station name), keeping its layout (one station or segment per line), never
regenerate it. The tests read every city through the schema, so one it refuses fails them;
`pnpm data:summaries` rewrites `cities/cities.json`, the site's one list of cities (the app's `CITIES`
is read from it), in its own order: a new city goes after the last of its country, and a city's
folder is its `meta.country` as a slug. A test fails while it is out of date.
A segment's track starts and ends on its stations' coordinates, within 15 m (`STATION_GAP_METRES` in
`packages/schema/src/validation/checks.constants.ts`), or the schema refuses it: the line would miss the station's dot.
Nor does track turn sharper than its trains can: measured over `CURVE_SPAN_METRES` either side of each
point, a turn is held to its mode's tightest curve (`MIN_CURVE_RADIUS_METRES`: a metro's 50 m, a
tram's 15 m), inside a segment and through a station, from one of a line's segments into another it
runs on at the same time. A corner, or a point run past a station and pulled back to it, is plain up
close in 3D. A station sits on its lines' track: where it does not, move the station onto the track,
never the track out to the station. Where an interchange's lines run apart underground, each line's
track curves gently to the one station point. Where a line's trains end at a station from two
directions and go back the way they came, the station says so (`reverses`); nowhere else may a line
turn back through it. A plan's station on track already built sits on that track: the plan splits it there.
A station's `infill` on a line is dated once the line runs there (dated after the line has left, it
says the line never called there); its `closed` while the line runs there. The schema refuses
any other. A line's fast track beside another's stopping one runs on the same segments, drawn side
by side, and each station it runs through without calling says so (`passes`): never a segment of
its own laid over theirs, which draws one line on top of the other.

A network beside the city's own (main-line suburban trains beside a metro) is `optional`: in the city's
data, with its history, but off until shown (the Lines panel's switch, `?with=<network>`). Off, it is
as if it were not there: `NetworkFacts` leaves out its lines, the track and stations only it has, and
its plans, so counts, history and the city list are the city's own. No line outside it may lean on
one of its lines (an alias).

Each city's test lists every date a line comes apart (`lineSplits` in `test/support/history.utils.ts`),
with a comment saying why: a works closure, a stretch that opened on its own. A wrong date looks just
the same and fails the test: fix the date, or, if history really parted the line, add it with its reason.

Each city has its outline beside its network, `<city>.boundary.json` (`CityBoundary`, from
OpenStreetMap's administrative boundary, simplified): what the Coverage section measures within. It is
the city's limits, or the county a network spans (Greater Manchester, Tyne and Wear), never a wider
region: a plan running out to the next towns stays outside. `pnpm data:boundary <city> [relation]`
fetches it (`src/boundary/`): again from the relation its `source` names, or from the OpenStreetMap
relation given, for a new city; it writes nothing the schema refuses or that holds half the city's
stations or fewer (its plans' where nothing is built). A test checks every city has one, in its
layout, holding more than half its stations.

There is no importer: London was imported from OpenStreetMap once and is curated from here. Its
dates are checked against Wikipedia's line, station and railway-company articles; a correction
goes in the network with that source in mind.
