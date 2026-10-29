# Railtime

An interactive map of a city's rail network: explore it as it is today or on any day since it
opened, play its history from the first line to today, one change at a time, or open a plan for what
it could become.

Live at **https://develcool777.github.io/railtime/**: every push to `main` is built with `nuxt generate`
and published on GitHub Pages (`.github/workflows/pages.yml`).

```
packages/data (a city's dataset)  →  packages/renderer (MapLibre)  →  web (Nuxt + Nuxt UI)
```

## Getting started

```bash
pnpm install
pnpm dev                 # http://localhost:5180
```

Links keep your place: `/london?date=1935-06-01&map=13.00/51.51300/-0.11500&station=aldwych` opens
London on 1 June 1935, zoomed on Aldwych with its panel open. `date` also takes a bare year (its last
day), `map` is `zoom/latitude/longitude` as on openstreetmap.org, and `plan=<id>` opens a plan. The
address follows the map as you explore; playback leaves it alone.

## Commands

```bash
pnpm dev                 # the web app
pnpm build               # production build of the Nuxt app
pnpm type-check          # every package
pnpm test-unit           # Vitest, every package, watch mode (pnpm test-unit-ci: once; pnpm test-unit-coverage)
pnpm eslint-check        # pnpm eslint-fix to fix
pnpm format              # Prettier (pnpm format-check to check)
pnpm code-quality:dead-code   # knip

pnpm data:format london  # check a city's dataset against the schema, tidy it and rewrite the index
```

## Layout

| Path                | What it is                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `packages/schema`   | The `Network` format every dataset is in and the renderer reads, with a Zod validator.                                |
| `packages/renderer` | The engine: `TransitMap`. See [its README](packages/renderer/_README.md).                                             |
| `packages/data`     | Every city's dataset, by country, and the index of them. See [its README](packages/data/README.md).                   |
| `web`               | The explorer: Nuxt 4 + Nuxt UI. The map, minimap and history player come from the renderer; every control is Nuxt UI. |

## Licence

The code is under the [MIT licence](LICENSE). The datasets in `packages/data/cities/` are derived from
OpenStreetMap and are under the [Open Database Licence](packages/data/LICENSE.md),
© OpenStreetMap contributors.
