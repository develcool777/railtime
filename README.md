# RailLineage

An interactive map of a city's rail network: explore it as it is today or on any day since it
opened, play its history from the first line to today, one change at a time, or open a plan for what
it could become.

Live at **https://raillineage.com/**: every push to `main` is built with `nuxt generate` and published
on Cloudflare (`.github/workflows/deploy.yml`, `web/wrangler.jsonc`).

## Getting started

```bash
pnpm install
pnpm dev                 # http://localhost:5180
```

## Commands

```bash
pnpm dev                 # the web app
pnpm build               # production build of the Nuxt app
pnpm type-check          # every package (each its own `type-check`, run by pnpm -r)
pnpm test-unit           # Vitest, every package, watch mode (pnpm test-unit-ci: once; pnpm test-unit-coverage)
pnpm eslint-check        # pnpm eslint-fix to fix
pnpm format              # Prettier (pnpm format-check to check)
pnpm code-quality:dead-code   # knip
pnpm code-quality:duplication # jscpd: a copy within or between packages
pnpm audit               # known advisories in the dependencies (exemptions in pnpm-workspace.yaml)
pnpm --filter @railtime/web test-e2e   # the built site in Chromium (Playwright; test-e2e-ui to watch)
pnpm test-mutation packages/schema   # Stryker: which deliberate bugs the folder's tests miss (no folder: the list, with scores)
pnpm test-bench          # how long opening London, a route, coverage and a frame take, beside the last run

pnpm data:summaries  # sum up every city into cities/cities.json, the landing page's list
pnpm data:previews london  # draw its card's pictures (needs Chrome)
pnpm data:boundary london  # fetch its outline from OpenStreetMap again; add a relation id for a new city

pnpm video:record kyiv     # record its video page (/video/kyiv, from pnpm dev, in 3D; --query "view=2d" for flat)
                           # into packages/video/videos/kyiv.mp4, after a rehearsal that caches every map tile
                           # the camera will look at (--no-rehearse skips it; the cache stays, in packages/video/.cache)
                           # (needs Chrome and ffmpeg: brew install ffmpeg; --page explorer records the explorer,
                           # played from where it opens until the camera rests on the whole network, as the
                           # page itself says; --fps, --size 1080x1920, --seconds, --out)
```

## How it's built

A pnpm workspace of TypeScript packages; every package keeps its tests beside its code.

```text
railtime/
├── packages/
│   ├── schema/      the Network format every city's network is in: format/ (its types), validation/ (the Zod
│   │                shape and the checks between parts), plan/ (building a plan on a network), core/
│   ├── renderer/    the engine, TransitMap: draws a network on MapLibre and plays its history; no UI
│   ├── data/        every city's network, by country (cities/<country>/<city>/), their summaries
│                    (cities/cities.json), pnpm data:summaries, and a test per city
│   ├── tooling/     the repo's own tools: the house's lint rules, pnpm test-mutation
│   └── video/       videos of the app: pnpm video:record, a page recorded frame by frame into an MP4
├── web/             the app: Nuxt 4 and Nuxt UI around the renderer; src/ by surface (features/explorer,
│                    features/landing, features/seo), shared code at its top
└── .github/         CI (checks on every pull request) and the Cloudflare deploy
```

A city's network flows one way: `data` → `schema` validates it → `renderer` draws it → `web` puts
controls around it. The landing page reads only the small index; a city's page loads its own network.

| What         | Used                                                                         |
| ------------ | ---------------------------------------------------------------------------- |
| App          | Nuxt 4 (Vue 3), Nuxt UI 4, Tailwind CSS 4; built static with `nuxt generate` |
| Map          | MapLibre GL, OpenFreeMap vector tiles, OpenStreetMap data                    |
| Data         | JSON networks, validated with Zod                                            |
| Code quality | TypeScript (strict), Vitest, Playwright, ESLint, Prettier, knip, jscpd       |

More: each package's README: [schema](packages/schema/_README.md) (the format and its doors),
[network](packages/network/_README.md) (the facts, steps and cursors),
[renderer](packages/renderer/_README.md) (frames), [data](packages/data/README.md) (each city and its
commands), [tooling](packages/tooling/_README.md) (the house's lint rules, mutation testing) and
[video](packages/video/_README.md) (recording).

## Licence

The code is under the [MIT licence](LICENSE). The datasets in `packages/data/cities/` are derived from
OpenStreetMap and are under the [Open Database Licence](packages/data/LICENSE.md),
© OpenStreetMap contributors.
