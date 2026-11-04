# CLAUDE.md

Guidance for Claude Code in this repository. The conventions follow `dataroom-ui`'s, and ESLint
enforces them: `pnpm eslint-check` must pass. Each convention below names the rule that checks it, so
a report points back here. The rules are in `eslint/`, a file a subject (`imports.config.js`,
`tests.config.js`, `vue.config.js`…), each saying, beside every rule it turns off, why;
`eslint.config.js` puts them in order, the later winning where two set one rule.

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
`boundary/`, `preview/`), `packages/tooling` (the repo's own tools: `pnpm test-mutation`, and the house's typed lint rules),
`packages/video` (videos of the app: `pnpm video:record <city>` records its video page frame by frame,
on a clock only it moves, into an MP4 with ffmpeg, after a rehearsal that fetches every map tile the
camera will look at into Chrome's own cache; a frame waits for what it draws, never for a stream open
as long as the page; what a video shows stays in `web`) and `web` (the app: the Nuxt 4 + Nuxt UI
explorer, and the video page, `/video/<city>`, in 3D or flat with `?view=2d`, under `pnpm dev` only).
`README.md` has the commands; `ARCHITECTURE.md` the contract between the parts;
`packages/network/_README.md` steps and cursors; `packages/renderer/_README.md` the frame model.

## Checks

`pnpm type-check`, `pnpm test-unit-ci`, `pnpm eslint-check`, `pnpm format-check` and
`pnpm code-quality:dead-code` (knip) must all pass; CI runs them on every pull request. Node 24.15 or
later and pnpm 11.9 (`engines`, `packageManager` in `package.json`; CI reads the same), required, not
warned of (`engineStrict`): on an older Node, pnpm runs nothing.
ESLint reads every file with its package's types (web's from `.nuxt/`, which `pnpm install` writes),
so the rules that need them hold too; `pnpm eslint-fix` sorts imports and fixes what a rule can.
Nothing is a warning: a rule is an error, or off with its reason, and `pnpm eslint-check` fails on a
warning too (`--max-warnings 0`), so a plugin's rule left on `warn` cannot slip by. Nor is a rule turned
off by a comment in the code (`noInlineConfig`): an exemption is a block in `eslint/`, with its reason.
After adding a city or changing one's lines, stations or plans, run `pnpm data:summaries` (the landing
page's list); after changing its track or lines' colours, `pnpm data:previews <city>` too (it draws the
landing page's pictures in Chrome).

## Conventions (enforced)

- **Arrow functions only.** `const name = (…): Type => …`; no `function`, declaration or expression
  (`func-style`, `no-restricted-syntax`).
- **A store is a setup store, laid out as `dataroom-ui`'s**: `defineStore(STORE_IDS.NAME, () => …)`, its
  id in `STORE_IDS` (`web/src/constants/store.constants.ts`, where a test finds every store's); inside,
  in this order, each under its heading comment: `// ---- State`, its refs; `// ---- Getters`, its
  computed; `// ---- Actions`, named in capitals (`OPEN`, `SET_TIME`, `RESET` where it needs one), so a
  call reads as one wherever it is made; then what it returns, in the same order, all its state among
  it (`house/store-returns-state`): Pinia keeps only what a setup store returns, and a ref left out is
  invisible to its devtools and plugins, and lost in server rendering. Its state changes
  only by its actions: a component or composable reads it and calls them. An action is a block,
  `(next) => { time.value = next; }`: it returns nothing (`jsdoc/require-returns` asks a `@returns` of
  one that does).
- **Loops say what they loop over.** No `for (;;)` or `while (true)`;
  `for (const [place, stop] of run.entries())`, never `forEach` (`unicorn/no-array-for-each`), nor
  `reduce` (`unicorn/no-array-reduce`): a sum or a fold is a loop and a `let`. A queue is read from its
  head, never `shift`ed, and a list built from its end is pushed then `toReversed()`, never
  `unshift`ed: each copies the whole array, so the loop is O(n²) (`unicorn/no-array-front-mutation`).
  Promises that need not wait for one another run together, `Promise.all` (`no-await-in-loop`; off for
  the data and video commands, which drive one page or a service asking for a pause between requests).
- **Imports in one block, in order** (`import-x/order`; `pnpm eslint-fix` sorts them): packages, `node:`
  among them, then the app's own (`#imports`, `~/`, `@test/`), then relative, each group alphabetical,
  no blank lines. No module imports itself round a circle (`import-x/no-cycle`), and a module's exports
  are constants (`import-x/no-mutable-exports`).
- **Modern JavaScript** (`unicorn`): an array is never sorted or reversed in place: `toSorted`,
  `toReversed` (`unicorn/no-array-sort`, `no-array-reverse`), with a comparator always
  (`require-array-sort-compare`, strings' sorts too: `byCodeUnits` from
  `@railtime/core/text.utils` for ids and ISO dates, `localeCompare` for a name a reader sees);
  `list.at(-1)`, `replaceAll`, `Number.isSafeInteger`, `Set` methods (`difference`); a callback that does
  nothing is `() => {}`. Each thing said one way: `===` (`eqeqeq`), `Boolean(x)` or a comparison for
  `!!x` (`no-implicit-coercion`), a template literal for `'a' + b` (`prefer-template`), `{ bounds }`
  (`object-shorthand`), `x += 1`, `Object.hasOwn`, `{ ...a }`. Nothing goes to the console but from a
  command (`no-console`). A parameter is never written over (`no-param-reassign`), nor a name hidden by
  an inner one (`no-shadow`); a member nothing writes after the constructor is `readonly`
  (`prefer-readonly`). The slips the language lets through are each refused: a `map` callback that
  returns nothing, `x === x`, a loop whose condition nothing in it changes, a `${}` in a plain string,
  `eval`. The rules that argue with the house style are off, each with its reason.
- **What the types say holds** (`typescript-eslint`'s strict, type-checked rules): no condition the types
  already answer (`no-unnecessary-condition`), `??` over `||` for a value that may be missing
  (`prefer-nullish-coalescing`), no promise left floating (`no-floating-promises`: awaited, or `void`
  where it is meant to run on its own), no `any` from `JSON.parse` or an untyped `new Map()` (say what
  it holds: `as CityIndex`, `new Map<string, string>()`), no assertion the types make needless. A
  `switch` over a union names each member or says `default` and why
  (`switch-exhaustiveness-check`): a new kind of step or overlay cannot slip past one. The compiler
  refuses what is never read or never returned (`tsconfig.base.json`: `noUnusedLocals`,
  `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`; web's
  too). A global type a library leans on is loaded where it is used (the renderer's `geojson`): left
  out, `skipLibCheck` turns it to `any` and says nothing.
- **A condition is a boolean** (`strict-boolean-expressions`), or a value whose truth cannot mislead:
  an object, a string, or one that may be missing (an id, a date, a name, a flag; never `''`). A
  number is compared, never taken for true: `0` is a count, an option, and the timestamp of
  1 January 1970 (`closes !== null`, `option > 0`). A sort's tie-breaks are `firstDifference(a - b,
nameCompare)` (`@railtime/core/collection.utils`), not `a - b || nameCompare`.
- **An id is its kind's** (`StationId`, `LineId`, `NetworkId`, `PlanId`: `Brand<string, …>`, in
  `schema`'s format): a line's id where a station's goes does not compile, and a map or set of them
  says which (`Map<StationId, number>`). A string becomes an id only where it is checked: `parseNetwork`
  for a city's file, `isStationIn`/`isLineIn`/`isPlanIn` (`facts.findStation`, `findLine`, `planToOpen`)
  for an address; never by `as` elsewhere (`house/checked-ids`). A record keyed by ids is walked with
  `keysOf`/`entriesOf` and made with `fromEntriesOf` (`@railtime/core/collection.utils`), which keep the
  key's kind, where `Object.keys` makes it `string` (`house/branded-record-keys`). An id key beside a
  spread, `{ ...plans, [id]: plan }`, is one TypeScript checks nothing under: copy, then set it by key
  (`house/branded-spread-key`). A test names its ids with `stationId('a')`, `lineId('red')`, and writes a
  network as its file is, `asNetwork({…})` (`@railtime/schema/testing/ids`), helpers that trust what
  they are given, which source never imports (`house/test-helpers`). The house's rules read types, and
  live, tested, in `packages/tooling/src/lint/`.
- **A key left out is not a key given `undefined`** (`exactOptionalPropertyTypes`, in the packages):
  `{ plan?: string }` takes no `plan: undefined`; pass it on as `...(plan && { plan })`, and leave a
  key out with `const { plans: _plans, ...rest } = network`. Where `undefined` does mean "not given",
  the type says so (`MapPropsUpdate`, the props `TransitMap.update` takes), and the code drops it,
  never spreads it over a default. Zod's `.exactOptional()` reads the files so. Web leaves this off: a
  template passes `undefined` to an optional prop to mean it is not given, as Vue and Nuxt UI read it.
- **Guard clauses**: an early `return` ends the case, with no `else` after it (`no-else-return`), each
  guard on its own line, never folded into one condition or a ternary.
- **A function a reader takes in at once** (`sonarjs/cognitive-complexity`, 15, as `dataroom-ui`'s): past
  that, it splits into named steps.
- **Classes live in `*.service.ts`**, helpers in `*.utils.ts`; a file may hold several classes of
  one subject (a base and its kinds). Types and constants keep files of their own, beside the code
  they belong to (`camera.types.ts` next to `camera.service.ts`): when code merges, its types and
  constants merge into the merged file's. No `types/` folders, no barrels (`check-file`). No file passes ~500
  lines: a subject that big splits by job, never by role. A `*.utils.ts` is pure: it takes no store,
  composable, Vue or map at run time (`house/pure-utils`), only their types.
- **Every class member has an access modifier** (`public`, `protected`, `private`), and every class,
  member, function, constant and type at a module's top has a JSDoc comment (`jsdoc/require-jsdoc`).
  A JSDoc mirrors its signature, a component's functions' too: a `@param name - what` for each
  parameter, a `@returns what` for a value (none for `void`, nor beside a getter, whose doc says what it
  is), no `{type}`, `[optional]` or default, which TypeScript says (`jsdoc/require-param`,
  `require-returns`, `no-types`); and it parses, naming no type it cannot find (`jsdoc/valid-types`,
  `no-undefined-types`): a `@throws` says what in words, `@throws Zod's error, if …`.
- **Names say what they hold**: three letters at least, but for `id`, `x`, `y`, `km`, `on`, `to` (`id-length`).
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
  No package takes Vue (its stores, Nuxt), and `core`, `schema` and `network` take no map either: the
  renderer is the one that draws (ESLint).

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
                          seo, video (a city's history as a video, to record: `pnpm dev` only, the
                          built site leaves it out; its state a store, `video.store.ts`, its rules in
                          `video.utils.ts`, its map an effect, `video.composable.ts`, as the explorer's;
                          all that moves on it is worked out from the page's clock each frame, never
                          a CSS transition, which no recorder can step);
                          its components in components/, the rest flat beside them
  features/<name>/<part>/ a big feature in parts, as dataroom-ui's modules/fileRenderer: each part
                          (explorer's map/, time/, panel/, lines/…) its own components/ and files;
                          the feature's top holds the frame and what the parts share, and a
                          _README.md maps it
  ```

  Components are used by tag, never imported (`nuxt.config.ts` scans every `components/` under
  `features/`); anything else in a feature is imported by its path
  (`~/features/explorer/time/timeline.utils`), so what one feature or part takes from another can be
  searched for. Something one surface uses goes in its feature; it moves to the top when a second needs it.

- **Stores are the one source of truth.** Every value lives in exactly one store, with all that is
  worked out from it (its getters), and changes only by that store's actions; their rules are pure
  functions in `*.utils.ts`, tested, and each store is tested (`test/unit/…/<name>.test.ts`, on a
  stand-in map, `@test/support/factories/transitMap.utils`). Stores read one another one way only,
  never in a circle. The explorer's: `network.store.ts` (the network shown, its facts, the plan and
  the lines hidden) and `map/map.store.ts` (the map, its credits, where it looks, its camera's
  commands) read none; `time/time.store.ts` (the time control, playback, every command through time)
  reads those two; `tools.store.ts` (a route, a reach, coverage and the city's outline) the network;
  `explorer.store.ts` (what is open, how the map is seen, `mapProps`, `address`, and the actions that
  span the others: a page opening, a plan or lines shown, the map arriving, a station clicked) reads
  them all; `panel/panel.store.ts` (getters only: what the panel shows) reads the rest, and nothing
  reads it.
- **A composable is an effect, and nothing else**: it ties something outside Vue to the stores (the
  map, the browser, the keys, the address bar), reading stores and calling their actions; it holds no
  state and works nothing out (ESLint refuses a `ref`, `computed` or `reactive` in one).
  `map/transitMap.composable.ts` makes the map and takes it down;
  `layout.composable.ts` gives the stores the screen and the theme, and drags the panel;
  `shortcuts.composable.ts` the keys; `address/address.composable.ts` writes the explorer's `address`
  to the address bar, its only writer. A component lays out what stores hold and calls their actions.
- What is looked at and how it is set goes in the address; dark or light, the one preference, in the browser (`features/explorer/_README.md`).

- Vue: `<script setup lang="ts">`, block order template → script → style, a blank line between
  them, `defineProps` before `defineEmits`, `props`/`emit`/`slots`/`attrs` names, camelCase attributes
  and events (`eslint-plugin-vue`). A template says a thing one way: `disabled`, not `:disabled="true"`,
  a static `class` apart from `:class`. An element's ref is `useTemplateRef<HTMLElement>('name')`; a
  child's, the type of what it exposes (`PanelListHandle`, beside its `defineExpose`). Nothing declared
  and unused: a prop, an event, a ref. A component's parts are declared and typed, as a function's:
  each prop with a JSDoc (`vue/require-prop-comment`), read as `props.name`, never destructured; its
  slots by `defineSlots` (`vue/require-explicit-slots`); a model its parent always binds is
  `required`, never given a default. A prop or ref read once at setup keeps the value it had
  (`vue/no-setup-props-reactivity-loss`): what follows it is a `computed`, a `watch` or read where it is
  used; a page mounted afresh for each city (its `key`) holds its city as a constant. An event never
  takes a browser's name (`select`, `change`, `play`): it says what it carries (`station`, `pick`,
  `togglePlay`) (`vue/no-shadow-native-events`). The same component in a `v-if` and its `v-else` is
  keyed apart, so one never takes the other's state (`vue/v-if-else-key`). A template's expressions
  are held to a script's (`vue/eqeqeq`, `vue/no-implicit-coercion`…), but for its guard clauses: the
  empty state first, `v-if="!from"`, what it shows in `v-else`.

## Tests

Each package keeps its tests beside its code, as dataroom-ui does inside its one app:

```text
packages/network/
  vitest.config.ts          the package's project (`pnpm --filter @railtime/network test-unit`)
  test/unit/                mirrors src/: test/unit/engine/timeline.test.ts tests src/engine/timeline.*.ts
  test/support/             what tests share: factories/ (tinyNetwork, planOnlyNetwork, boundaries:
                            exported as `@railtime/network/testing/*` for the other packages' tests), facts.utils.ts
packages/renderer/
  test/unit/                mirrors src/, as network's; transitMap.spec.ts tests the contract whole
  test/support/             fakeMap, playback.utils.ts (a player wired as the map wires it, and what
                            the map draws: `@railtime/renderer/testing/playback` for data's city tests)
packages/data/
  test/unit/<feature>/      mirrors src/<feature>/: city/ (finding the cities and reading their files),
                            format/, boundary/, preview/ (a command each)
  test/unit/cities/         one test per city: unitedKingdom/london.test.ts checks
                            cities/united-kingdom/london/london.json, played through the renderer
  test/bench/               the work a visitor waits on, timed on the largest city (`pnpm test-bench`)
web/test/unit/              mirrors web/src/ for its plain helpers (*.utils.ts); components are checked in the browser;
                            they import as the app does, from ~/, and test/support/ from @test/
```

- `network` and the renderer know no city: their tests use made-up networks (`tinyNetwork`). A check of a city's
  history (the Victoria line's three stages, London's size today) goes in
  `packages/data/test/unit/cities/<country>/<city>.test.ts`. Nor do `core`, `schema`, `network` or the
  renderer name one, in their code, comments or tests: `data`'s `city.test.ts` reads every city's
  name in `cities.json` and fails on any it finds there.

- `pnpm test-unit` at the root runs every project (`vitest.config.ts`); options shared by all are in
  `vitest.shared.ts`: mocks reset between tests, random order, node.
- **A test file's name picks its environment**, as in dataroom-ui: `*.test.ts` runs in node, `*.spec.ts`
  in happy-dom, for code that makes elements of its own (the minimap's box, `BasemapStill`'s hidden
  container); each is a project of its own (`projectsOf` in `vitest.shared.ts`). Never a
  `@vitest-environment` comment.
- **Tests run the real code.** No `vi.mock` (ESLint): build the input with a factory in `test/support/`.
- A test mirrors one source file, or Vitest refuses to start; `*.test.ts` and `*.spec.ts` only in `test/unit/`,
  helpers only in `test/support/` (ESLint).
- `describe('<Module>')` (`Timeline`, `GrowthUtils`), a nested `describe` per function for a utils
  module, then `test('does what, when')`; never `it`, nor a test left `.only`, `.skip` or `.todo`, nor
  one only some runs make (`@vitest/eslint-plugin`, `vitest/no-conditional-tests`). A throw is
  checked for what it says, `toThrow('Missing step 9')`: `toThrow()` passes for any error
  (`vitest/require-to-throw-message`). Each check says what it checks, so a failure says what went wrong:
  `toHaveLength(n)`, `toBeNull()`, `toContain`, `toBeGreaterThan` (`vitest/prefer-to-*`). No `expect`
  inside an `if` (`vitest/no-conditional-expect`): gather what a loop finds, then check it once
  (`expect(far).toEqual(far.map(() => Infinity))`).
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
- Benchmarks, by hand: `pnpm test-bench` times the work a visitor waits on, on London, the largest
  network (in `packages/data/test/bench/`, with the cities: `network` and the renderer know none):
  opening a city, a route, a reach, coverage's history, a frame's snapshot. Each is set beside its last
  run on this machine (kept in `packages/data/test-reports/bench/`, never committed): run it on main,
  then on a branch, to see what the branch changed; a few per cent either way is noise. Each first
  checks its work does its job, so a slip cannot pass for speed. Work a visitor waits on gets one. Lint
  cannot see how much data a loop runs over; this does.

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
A plan's new track runs where its `track` says, between two stations a section links (over a bridge,
round a curve), as a segment's, one per line; where it says nothing, the plan curves it through its
line's stations, on from the track the line already has. Either way the schema holds it as it holds
built track: its ends on its stations, no turn sharper than its trains can, inside it or through a station.
A plan plays in its order, line by line: a line's sections go together and play as one, the line
growing from an end, never from its middle one way and back, a branch after the way it leaves, built whole
before the next, and its track unbroken, a section adding only stations on it before or after the
sections laying it, never between (the schema refuses either).
A station's `infill` on a line is dated once the line runs there (dated after the line has left, it
says the line never called there); its `closed` while the line runs there; its `suspended`, spells it
closed for a while and reopened, each while the line runs there and calls, in order. The schema refuses
any other. A line's fast track beside another's stopping one runs on the same segments, drawn side
by side, and each station it runs through without calling says so (`passes`): never a segment of
its own laid over theirs, which draws one line on top of the other.

Any line, or a network's lines at once, can be hidden (the Lines panel's eyes, for the visit). Hidden, it is as if it were not there:
`NetworkFacts.create(network, { hidden })` leaves out the line, the track and stations only it has,
and a plan's sections on it (the plan with none left), so every count, the history, the coverage and the routes are without
it; a station only it has that a plan builds on is the plan's own again, and so is the track only it has
between two stations a plan's section links: the plan runs on it still, never laying its own beside it; the years another line was
drawn as it (an alias) go too: that line's gap, which the engine cuts its runs at, the line going as
what it was drawn as and coming back as itself, with no step saying it changed. There is no other hiding: the map
draws what the facts have. A network beside the city's own (main-line suburban trains beside a
metro) is `hidden` at first: in the city's data, with its history, but hidden until shown, so the
city list counts the city's own. One older than the city gives its own `start`, where the timeline
starts while one of its lines shows; the schema refuses a line opening before its timeline starts,
which would never play.

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
