# Railtime

An interactive map of a city's rail network: explore it as it is today or on any day since it
opened, play its history from the first line to today, one change at a time, or open a plan for what
it could become.

Live at **https://develcool777.github.io/railtime/**: every push to `main` is built with `nuxt generate`
and published on GitHub Pages (`.github/workflows/pages.yml`).

## Getting started

```bash
pnpm install
pnpm dev                 # http://localhost:5180
```

## Commands

```bash
pnpm dev                 # the web app
pnpm build               # production build of the Nuxt app
pnpm type-check          # every package
pnpm test-unit           # Vitest, every package, watch mode (pnpm test-unit-ci: once; pnpm test-unit-coverage)
pnpm eslint-check        # pnpm eslint-fix to fix
pnpm format              # Prettier (pnpm format-check to check)
pnpm code-quality:dead-code   # knip
pnpm test-mutation packages/schema   # Stryker: which deliberate bugs the folder's tests miss (no folder: the list, with scores)

pnpm data:format london  # check a city's dataset against the schema, tidy it and rewrite the index
pnpm data:previews london  # draw its card's pictures (needs Chrome)
```

## How it's built

A pnpm workspace of TypeScript packages; every package keeps its tests beside its code.

```text
railtime/
├── packages/
│   ├── schema/      the Network format every dataset is in: format/ (its types), validation/ (the Zod
│   │                shape and the checks between parts), plan/ (building a plan on a network), core/
│   ├── renderer/    the engine, TransitMap: draws a network on MapLibre and plays its history; no UI
│   ├── data/        every city's dataset, by country (cities/<country>/<city>/), the index of them
│                    (cities/cities.json), pnpm data:format, and a test per city
│   └── tooling/     the repo's own tools: pnpm test-mutation
├── web/             the app: Nuxt 4 and Nuxt UI around the renderer; src/ by surface (features/explorer,
│                    features/landing, features/seo), shared code at its top
└── .github/         CI (checks on every pull request) and the GitHub Pages deploy
```

A city's dataset flows one way: `data` → `schema` validates it → `renderer` draws it → `web` puts
controls around it. The landing page reads only the small index; a city's page loads its own dataset.

| What         | Used                                                                         |
| ------------ | ---------------------------------------------------------------------------- |
| App          | Nuxt 4 (Vue 3), Nuxt UI 4, Tailwind CSS 4; built static with `nuxt generate` |
| Map          | MapLibre GL, OpenFreeMap vector tiles, OpenStreetMap data                    |
| Data         | JSON datasets, validated with Zod                                            |
| Code quality | TypeScript (strict), Vitest, ESLint, Prettier, knip                          |

More: [the renderer's README](packages/renderer/_README.md) (steps, cursors, frames) and
[the data's](packages/data/README.md) (the dataset format and each city).

## Licence

The code is under the [MIT licence](LICENSE). The datasets in `packages/data/cities/` are derived from
OpenStreetMap and are under the [Open Database Licence](packages/data/LICENSE.md),
© OpenStreetMap contributors.
