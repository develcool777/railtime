# Tests

How every package tests, and the rules ESLint and Vitest hold tests to. Read it before writing or moving
a test. `CLAUDE.md` holds the conventions every file follows.

Each package keeps its tests beside its code, as dataroom-ui does inside its one app:

```text
packages/network/
  vitest.config.ts          the package's project (`pnpm --filter @railtime/network test-unit`)
  test/unit/                mirrors src/, a test a file, named for it: test/unit/engine/timeline.service.test.ts
                            tests src/engine/timeline.service.ts, timeline.utils.test.ts its utils
  test/support/             what tests share: factories/ (tinyNetwork, planOnlyNetwork, boundaries,
                            hiddenNetwork: exported as `@railtime/network/testing/*` for the other packages' tests), facts.utils.ts
packages/renderer/
  test/unit/                mirrors src/, as network's; transitMap.service.spec.ts tests the contract whole
  test/support/             fakeMap, playback.utils.ts (a player wired as the map wires it, and what
                            the map draws: `@railtime/renderer/testing/playback` for data's city tests)
packages/data/
  test/unit/<feature>/      mirrors src/<feature>/: summary/, boundary/, preview/ (a command each)
  test/unit/city.utils.test.ts  finding the cities and reading their files
  test/unit/cities/         one test per city: unitedKingdom/london.test.ts checks
                            cities/united-kingdom/london/london.json, played through the renderer
  test/bench/               the work a visitor waits on, timed on the largest city (`pnpm test-bench`)
web/test/unit/              mirrors web/src/ for its helpers (*.utils.ts) and stores; they import as the app does,
                            from ~/, and test/support/ from @test/
web/test/e2e/               the built site in Chromium (Playwright, `*.e2e.ts`, a file per surface: landing, explorer)
```

- `network` and the renderer know no city: their tests use made-up networks (`tinyNetwork`). A check of a city's
  history (the Victoria line's three stages, London's size today) goes in
  `packages/data/test/unit/cities/<country>/<city>.test.ts`. Nor do `core`, `schema`, `network` or the
  renderer name one, in their code, comments or tests: `data`'s `city.utils.test.ts` reads every city's
  name in `cities.json` and fails on any it finds there.

- `pnpm test-unit` at the root runs every project (`vitest.config.ts`); options shared by all are in
  `vitest.shared.ts`: mocks reset between tests, random order, node.
- **A test file's name picks its environment**, as in dataroom-ui: `*.test.ts` runs in node, `*.spec.ts`
  in happy-dom, for code that makes elements of its own (the minimap's box, `BasemapStill`'s hidden
  container); each is a project of its own (`projectsOf` in `vitest.shared.ts`), in every package and
  `web` (ESLint refuses `defineProject` there). Never a `@vitest-environment` comment.
- **Tests run the real code.** No `vi.mock` (ESLint): build the input with a factory in `test/support/`.
- **A test and its file are named for each other**, suffix and all, as in dataroom-ui: `trains.service.ts` is
  tested in `trains.service.test.ts`, `trains.utils.ts` in `trains.utils.test.ts`. A test names a source file that
  is there, and every service, utils and store has its test (`house/mirrored-tests`); a city's test names its
  city (`vitest.shared.ts`). `*.test.ts` and `*.spec.ts` only in `test/unit/`, helpers only in `test/support/` (ESLint).
- `describe('<Module>')` (`Timeline`, `GrowthUtils`), a nested `describe` per function for a utils
  module, then `test('does what, when')`; never `it`, nor a test left `.only`, `.skip` or `.todo`, nor
  one only some runs make (`@vitest/eslint-plugin`, `vitest/no-conditional-tests`). A throw is
  checked for what it says, `toThrow('Missing step 9')`: `toThrow()` passes for any error
  (`vitest/require-to-throw-message`). Each check says what it checks, so a failure says what went wrong:
  `toHaveLength(n)`, `toBeNull()`, `toContain`, `toBeGreaterThan` (`vitest/prefer-to-*`). No `expect`
  inside an `if` (`vitest/no-conditional-expect`): gather what a loop finds, then check it once
  (`expect(far).toEqual(far.map(() => Infinity))`).
- A `console.warn` or `console.error` during a test fails it (`vitest.setup.ts`).
- **The site in a browser** (`pnpm --filter @railtime/web test-e2e`; CI runs it): `nuxt generate`'s build,
  served as Cloudflare serves it (`web/test/e2e/serve.json`: a page's folder at its address with a slash),
  in Playwright's Chromium (`web/playwright.config.ts`). Only what a browser alone shows: a city opening on
  its map, the address read back after a reload, playback, the layout on a phone, a page that is not
  there. What a component or store does is a unit test. Each test takes `test` and `expect` from
  `web/test/support/browser.utils.ts`, which answers the basemap with a stand-in style (no test waits on
  the tile server) and fails a test on an error the page throws or logs, or a request outside the build.
  Elements are found as a visitor finds them: by role and name, never a class or a test id.
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
