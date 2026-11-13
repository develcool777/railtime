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
and its plans; `NetworkEngine`, `engineOf(facts)`, the raw network the renderer plays and draws),
`packages/renderer` (drawing: the MapLibre engine, `TransitMap`), `packages/data` (storage: every
city's files in `cities/<country>/<city>/`, its network `<city>.json`, outline and pictures; the index
of them, `cities/cities.json`; and the commands that keep them, a folder each in `src/`: `summary/`,
`boundary/`, `preview/`), `packages/tooling` (the repo's own tools: `pnpm test-mutation`, and the house's typed lint rules),
`packages/video` (videos of the app: `pnpm video:record <city>` records its video page frame by frame,
on a clock only it moves, into an MP4 with ffmpeg, after a rehearsal that fetches every map tile the
camera will look at into Chrome's own cache; it knows a page by its handle alone, which starts it, says
when it is over, and says a frame is drawn, the map answering: the tiles in view, never motion, which
stands still with the clock; what a video shows stays in `web`) and `web` (the app: the Nuxt 4 + Nuxt UI
explorer, and the video page, `/video/<city>`, in 3D or flat with `?view=2d`, under `pnpm dev` only;
`pnpm video:record <city> --query "plan=<id>"` records a plan of the city's as its ending).
`README.md` has the commands; `ARCHITECTURE.md` the contract between the parts;
`packages/network/_README.md` steps and cursors; `packages/renderer/_README.md` the frame model.

## Checks

`pnpm type-check` (each package's own, by `pnpm -r`: a new package gives itself one), `pnpm test-unit-ci`,
`pnpm eslint-check`, `pnpm format-check`, `pnpm code-quality:dead-code` (knip),
`pnpm code-quality:duplication` (jscpd: a helper copied rather than moved to `core` fails it),
`pnpm audit` and `pnpm --filter @railtime/web test-e2e` (the built site in Chromium, `web/test/e2e/`) must
all pass; CI runs them on every pull request. An advisory with no fix to take is listed under
`auditConfig` in `pnpm-workspace.yaml` with its reason, never left failing. Node 24.15 or later
(`.nvmrc` the line CI installs, `engines` its floor) and pnpm 11.9 (`packageManager`), required, not
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
  invisible to its devtools and plugins, and lost in server rendering. The headings' order, each part
  under its own, what it returns in that order and an action's capitals are `house/store-shape`'s. Its
  state changes only by its actions: a component or composable reads it and calls them, which no rule
  can see, as Pinia hands out its refs. An action is a block,
  `(next) => { time.value = next; }`: it returns nothing (`jsdoc/require-returns` asks a `@returns` of
  one that does).
- **Loops say what they loop over.** No `for (;;)` or `while (true)`;
  `for (const [place, stop] of run.entries())`, never `forEach` (`unicorn/no-for-each`), nor
  `reduce` (`unicorn/no-array-reduce`): a sum or a fold is a loop and a `let`. A queue is read from its
  head, never `shift`ed, and a list built from its end is pushed then `toReversed()`, never
  `unshift`ed: each copies the whole array, so the loop is O(n²) (`unicorn/no-array-front-mutation`).
  Promises that need not wait for one another run together, `Promise.all` (`no-await-in-loop`; off for
  the data and video commands, which drive one page or a service asking for a pause between requests).
- **Imports in one block, in order** (`import-x/order`; `pnpm eslint-fix` sorts them): packages, `node:`
  among them, then the app's own (`#imports`, `~/`, `@test/`), then relative, each group alphabetical,
  no blank lines. No module imports itself round a circle (`import-x/no-cycle`), and a module's exports
  are constants (`import-x/no-mutable-exports`).
- **Modern JavaScript** (`unicorn`): an array is never sorted or reversed in place, as a statement of its
  own either: `toSorted`, `toReversed` (`unicorn/no-array-sort`, `no-array-reverse`, `allowExpressionStatement`
  off), with a comparator always
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
  for an address; never by `as` elsewhere, a template's expressions included (`house/checked-ids`). A
  city's file becomes a `Network` or a `CityBoundary` at a door: `parseNetwork`/`parseBoundary`, which
  check it, or in the browser `servedNetwork`/`servedBoundary` (`@railtime/schema/served.utils`), which
  trust what CI checked; never by `as` or a fetch's type argument elsewhere (`house/served-files`). A record keyed by ids is walked with
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
  constants merge into the merged file's. No `types/` folders, no barrels (`check-file`). No source file
  passes 500 lines, comments counted (`max-lines`; a test may): a subject that big splits by job, never by role.
  A page's script bundled for the browser is a `*.entry.ts` (`preview/page.entry.ts`), typed as any other. A `*.utils.ts` is pure: it takes no store,
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
  through `required()` (or `NetworkIndex.stationOf`/`lineOf`), which fails loudly; in source, `!` only on a
  numeric index a loop's head bounds, with a `// Within bounds:` comment saying why (`house/bounded-assertion`);
  anything else is restructured so the types see it. A test may: a `!` that is wrong fails it.
- **A command is a feature's `cli.ts`** (`packages/data/src/boundary/cli.ts`, `pnpm data:boundary`): it
  reads its arguments, calls the feature in a `try`, and on an error says it, with its usage, and sets
  `process.exitCode = 1`. The feature knows nothing of the command: it takes typed arguments, says how it
  goes through the `report` it is given, throws what went wrong, and closes what it opened; only a
  `cli.ts` touches the console (`no-console`). A function in the feature's utils, or a service where it
  holds state (`PreviewRenderer`: a server, Chrome, a page); beside it one types and one constants file.
- **Erasable TypeScript only** (`erasableSyntaxOnly`): scripts run directly under Node's type
  stripping, so no enums or constructor parameter properties; and in the code they run (`core`,
  `schema`, `network`, `data/src`) a runtime import names its file, `.ts` included (ESLint).
- **A package through its door**: another package is imported by its `exports` (`@railtime/<package>/…`),
  never by a path into its folders (ESLint); what its tests share, from `@railtime/<package>/testing/…`.
  `@railtime/network/engine.*` is the renderer's alone, `web`'s and `data`'s code and tests kept out (ESLint):
  `engineOf(facts)` is the one way from a network's facts to the engine. One exception the fence does not
  see: `data`'s `london.test.ts` and `lineSplits` read the raw `index` and `timeline` that `playbackOf`
  (`@railtime/renderer/testing/playback`) hands over, for what no fact says: which stretch a step opens, a
  segment's direction, a line's track holding together past a junction its trains pass. Else they ask the facts.
  No package takes Vue (its stores, Nuxt), and `core`, `schema` and `network` take no map either: the
  renderer is the one that draws (ESLint).

## Architecture

- **A fact is `network`'s.** A count, a length, a station's neighbours, a route, a caption: a method
  on `NetworkFacts` (or the `FactsAt` its `asOf` gives, `facts/moment.service.ts`), tested in `packages/network`; `web` and `data`
  ask it, never work it out, and never import its `engine.*` (`NetworkEngine`, `engineOf`, ESLint), which is the
  renderer's: a city's test reads the raw network only as the renderer's playback hands it over.
  Every answer at a moment says what the map draws then: a line drawn as another (`LineAlias`) is that line, in a
  station, a route (with no change between them), a line and the records (`Timeline.drawnAs`). No
  answer takes a theme: a line's colour is a `LineColor` in both, and what shows it picks one. `web` keeps presentation: formatting, grouping, the search.
- **The renderer has no UI and no facts.** Controls, captions and panels are Nuxt UI components in
  `web`; the renderer takes props, commands and listeners (`transitMap.types.ts`, `ARCHITECTURE.md`)
  and never imports Vue. A setting it shows is a prop, never a `setX` method.
- **Pure first.** All of `packages/network`, the renderer's player, `steps/` and every `*.utils.ts`
  take no map: keep new logic there and test it (docs/TESTING.md). A layer
  group is tested on the stand-in map (`test/support/factories/fakeMap.utils.ts`), which refuses what
  MapLibre would: a layer the style spec does not allow, data that is not GeoJSON features, and a
  layer reading (`['get', name]`) a property no feature of its source has.
- **A folder per subject, of two files or more** (a single file joins the nearest subject's folder);
  files named for what they are, not the folder again (`overlay/route.service.ts`, `RouteLayer`),
  but for the folder's main class and its one shared types, constants or utils file, which take
  its name (`engine/engine.service.ts`, `overlay/overlay.utils.ts`). Classes keep their full names.
- **A new kind of step** is its times in `STEP_TIMES` and a case in `StepAnimation`'s `cameraPoints`,
  `baseAt` and `draw` (`steps/animation.service.ts`): one class for every kind, its pure parts in
  `animation.utils.ts`.
- **A new group of map layers** is a `MapLayer` subclass installed by `MapLayers` (`layers/stack.service.ts`).
- **Something that moves every frame** (the trains, and whatever comes to move) is a kind of mover: a
  `MoverKind` with its `MoverStyle`, its movers given each frame to `MotionLayer.show`
  (`motion/motion.service.ts`), which the map draws itself, in its own WebGL, as it draws a frame. Never
  a GeoJSON source sent each frame: MapLibre cuts a source's tiles again in a worker for every send, so
  what moves would lag and stutter.
- **Trains on the map are an illustration, run by what real lines do.** The network keeps no timetable, so
  `network`'s `trains/` works one out as an operator does, the same way for any city, and never a number
  tuned for one. `TRAIN_PROFILES` says how each `Mode` runs, in real units: a figure from a published source where one
  exists, cited, and the rest fitted, each saying so (`trains.constants.ts`); a city's test holds them to its
  real times (Kyiv's average speed, Glasgow's lap, the Victoria line end to end). A route's ride is timed from them too,
  by the same motion rules (`RouteFinder`), so a route and the trains agree.
  Every way along a line from end to end (`routes.utils.ts`): a branch goes on past its fork towards the core,
  the side more lines meet, never doubling back. A train pulls away, runs and brakes (`motion.utils.ts`).
  The timetable repeats each hour (`CYCLE_SECONDS`), and is the tracks' (`TrackTimetable`, `tracks.service.ts`): a
  track is a segment's, any line's on it unless its `tracks` part them, and has room for as many trains an hour as its
  most cautious kind's signals let come (`closestSeconds`), but for a margin (`TRACK_USE`). A route runs at its kind's
  headway where its tracks have room; where one has not, its routes share it evenly, the leftover a train at a time to
  the line running fewest. The busiest routes are placed first, each train out as near its even time as is clear of
  every train already on each track it takes, whichever line's, and back as soon as it has turned; a train with no
  clear time is squeezed in least close. A line's platforms at an end are its own. `TrainService` turns the trains: at
  each end of a line every train coming in takes the next one out, whichever route, first in first out, standing at
  its platform until then, never out of sight; so how many trains run comes out of the timetable, never aimed at. A
  loop has no terminus: trains go on round, each way its own, or the one way a line's `way` says, where a circle's two
  directions are two lines. `TrainService` (`engine.trainService`) says where each train is, from the clock
  alone, so a recorder can step them. The clock is real time: how
  much faster to show it is the map's (`TRAIN_TIME_LAPSE`). The renderer only draws them: each a stretch of its
  line's track, not a point, so it sits where its line is drawn on shared track, a mover of `MotionLayer`'s. The map's `trains` prop turns
  them on, the app takes them off while history plays, and where lines are brought forward only theirs run.
- **The web app** follows the investors site's layout, in `web/src/`:

  ```text
  pages/  css/            routes, styles
  components/ui/          components every surface uses (SiteHeader, MapCredits, the charts: GrowthChart,
                          DecadeChart, CoverageChart, on YearChart's round years…; a number on rolling reels: ReelNumber draws a count,
                          CountingNumber counts to each value on the page's clock, which a recorder moves)
  constants/  utils/      what more than one surface needs: the city catalogue (CITIES, city.utils,
                          its outline fetched), plans' statuses, how a number, a share, a walk or
                          what a plan adds is written, a measure's growth
  features/<name>/        one product surface each: explorer (a city's map), landing (the city list),
                          seo, video (a city's history as a video, to record, a script of beats worked
                          out up front, `videoScriptOf`: its title, the history to today, the whole
                          network flat, its numbers on `insights/` panels round it, its coverage drawn,
                          and the end card over them; with `?plan=<id>` on past them, the plan played
                          from today, the network with it built flat, and its end card beside it, what it
                          changes rolling on from today's figures;
                          `pnpm dev` only, the built site leaves it out; its state a store,
                          `video.store.ts`, its rules in `video.utils.ts`, its map an effect,
                          `video.composable.ts`, as the explorer's; what it moves itself is worked out
                          from the page's clock each frame, never a CSS transition, which no recorder
                          can step);
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
  functions in `*.utils.ts`, tested, and each store is tested (`test/unit/…/<name>.store.test.ts`, on a
  stand-in map, `@test/support/factories/transitMap.utils`). Stores read one another one way only,
  never in a circle. The explorer's: `network.store.ts` (the network shown, its facts, the plan and
  the lines hidden), `map/map.store.ts` (the map, its credits, where it looks, its camera's commands)
  and `layout.store.ts` (how the page fits the screen: a phone's or not, the panel's width, the sheet)
  read none; `time/time.store.ts` (the time control, playback, every command through time) reads the
  network and the map; `tools.store.ts` (a route, a reach, coverage and the city's outline) the network;
  `explorer.store.ts` (what is open, how the map is seen, `mapProps`, `address`, and the actions that
  span the others: a page opening, a plan or lines shown, a station clicked) reads
  them all; `panel/panel.store.ts` (getters only: what the panel shows) reads the rest, and nothing
  reads it.
- **A composable is an effect, and nothing else**: it ties something outside Vue to the stores (the
  map, the browser, the keys, the address bar), reading stores and calling their actions; it holds no
  state and works nothing out (ESLint refuses a `ref`, `computed` or `reactive` in one).
  `map/transitMap.composable.ts` makes the map and takes it down;
  `layout.composable.ts` gives the stores the screen and the theme, and drags the panel;
  `shortcuts.composable.ts` the keys; `address/address.composable.ts` writes the explorer's `address`
  to the address bar, its only writer; `recorded.composable.ts` gives a recorder its handle, under
  `pnpm dev`. A component lays out what stores hold and calls their actions.
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

[docs/TESTING.md](docs/TESTING.md): where each package's tests live, a file's name picking its
environment, the rules a test keeps (no `vi.mock`, `describe('<Module>')`, `test`, a matcher that says
what it checks), the browser tests, coverage, mutation testing and benchmarks. Read it before writing a
test.

## Data

[docs/DATA.md](docs/DATA.md): a city's network as its source of truth (edited directly, never
regenerated), what the schema holds its track, stations and plans to, hidden lines and networks, the
dates each city's test lists, and its outline. Read it before editing anything in `packages/data/cities/`.

## Traps

- `typescript` resolves to 6 through the override in `pnpm-workspace.yaml`: vue-tsc and `nuxt typecheck`
  do not load on 7 yet. `overrides`, `patchedDependencies` and `auditConfig` are read from that file only.
- `minimatch` is 11 throughout (a security override), and `eslint-plugin-import-x` is patched to run on it
  (`patches/`): a new version of either needs the patch checked again, or ESLint fails to load.
- The required check on `main` is named `CI`: the gate job in `.github/workflows/test.yml` keeps that
  name. Requiring a job by its own name pins it: renamed, its check never reports again.
- Run Prettier from the root: inside a package it misses the root's `.prettierignore` and rewrites the
  cities' files, which keep a line per station and segment.
- A city's page is published at its address with a slash (`/kyiv/`): a link or a navigation the app
  makes says it so, as the site redirects to it.

## Pull requests

One small PR per change, branched from `main`. Never force-push: fix with a follow-up commit. No
`Co-Authored-By` trailers or tool footers.
