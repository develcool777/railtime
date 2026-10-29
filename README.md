# Railtime

An interactive map of a city's rail network that you can explore as it is today, or as it was in
any year, and a history player that grows it from the first line to today, one change at a time.
London (every Underground and Overground line and the Elizabeth line, 1863 to today), Manchester Metrolink (1992 to today) and the
Tyne and Wear Metro (1980 to today).

```
data/london/london.json   the dataset: lines, stations, track and when each line opened where
        │  (served as it is, at /data/london/london.json)
        ▼
renderer (packages/renderer, MapLibre)  →  explorer (web, Nuxt + Nuxt UI)
```

Live at **https://develcool777.github.io/railtime/**: every push to `main` is built with `nuxt generate`
and published on GitHub Pages (`.github/workflows/pages.yml`).

## Getting started

```bash
pnpm install
pnpm dev                 # http://localhost:5180
```

Links keep your place: `/london?date=1935-06-01&map=13.00/51.51300/-0.11500&station=aldwych` opens
London on 1 June 1935, zoomed on Aldwych with its panel open. `date` also takes a bare year (its last
day), and `map` is `zoom/latitude/longitude` as on openstreetmap.org. The address follows the map as
you explore; playback leaves it alone.

## Commands

```bash
pnpm dev                 # the web app
pnpm build               # production build of the Nuxt app
pnpm type-check          # every package
pnpm test-unit           # Vitest, every package, watch mode (pnpm test-unit-ci: once; pnpm test-unit-coverage)
pnpm eslint-check        # pnpm eslint-fix to fix
pnpm format              # Prettier (pnpm format-check to check)
pnpm code-quality:dead-code   # knip

pnpm data:format london  # check data/london/london.json against the schema and tidy it, after an edit
```

## Layout

| Path                | What it is                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `packages/schema`   | The `Network` format every dataset is in and the renderer reads, with a Zod validator.                                |
| `packages/renderer` | The engine: `TransitMap`. See [its README](packages/renderer/_README.md).                                             |
| `web`               | The explorer: Nuxt 4 + Nuxt UI. The map, minimap and history player come from the renderer; every control is Nuxt UI. |
| `scripts/`          | `cli.formatCity.ts` (`pnpm data:format <city>`): validates a city's dataset and keeps its layout.                     |
| `data/<city>/`      | `<city>.json`: the city's dataset and source of truth. The app serves it, the tests check it.                         |

## Data

`data/london/london.json` is the source of truth: one line per station and per segment of track,
each segment listing its lines and the day each opened (and closed) there. Fix a date by editing it,
then `pnpm data:format london`; a test fails while the file is invalid or untidy.

- Track and stations: **OpenStreetMap** (ODbL, credited on the map), imported once.
- Dates: checked line by line against Wikipedia's line, station and railway-company articles.
- `aliases`: lines drawn as another line until a date (Circle as Metropolitan until 1949,
  Hammersmith & City until 1990, the Overground as one line until 2024).

A new city is a new dataset in the same format, `data/<city>/<city>.json`, checked by the same test,
plus one entry in `CITIES` (`web/app/utils/explorer.constants.ts`): it gets a card on the
landing page and its own page at `/<city>`. Its history gets a test of its own,
`data/test/unit/<city>.test.ts` (camelCase), which plays it through the renderer.

London's closed sections are in: the Metropolitan to Aylesbury, Verney Junction and Brill, the Central
to Ongar, the District to Windsor, Hounslow Town, South Acton, Uxbridge and Hounslow West, the
Bakerloo to Watford, the H&C to Richmond and Kensington, King William Street, the old East London and
Northern City lines, and ghost stations. A line that left a section and came back (Aldwych in the
war, the Bakerloo at Harrow 1982–84, the East London line 1995–98) is `suspended` there.

Known gaps: the District's steam trains to Southend (1910–39) and Upminster (1902–05) are left out;
the Northern City line is drawn as the Metropolitan from 1904, though it was independent until 1913;
Overground routes appear when they became Overground, not as the older railways they are.

Manchester's lines are the lines as built (Bury, Altrincham, the city centre, …), not today's coloured
services, which share track and were reshuffled in 2018. Its one closed section is the 2012–2014 route
over the old railway via Werneth to the temporary Oldham Mumps stop. Stops that closed while their
track stayed (Mosley Street, High Street, Woodlands Road) and renamed ones (G-Mex, Barton Dock Road)
are in the dataset.

Tyne and Wear's lines are the Green and Yellow, which swapped southern branches on 12 December 2005:
until then Green ran to South Shields (from 1984) and Yellow to Sunderland and South Hylton (from
2002). The Red (Pelaw–Benton) and Blue (St James–North Shields) routes of the 1980s and 1990s are left
out: no source dates them. South Shields' move in 2019 and Meadow Well's former name (Smith's Park)
are in the dataset.
