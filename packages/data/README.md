# @railtime/data

Every city's dataset, grouped by country, the index of them, each city's preview pictures, the
commands that keep them, and their tests.

```text
packages/data/
  cities/
    cities.json                          the index: what the landing page shows of each city
    united-kingdom/london/london.json    a city's dataset, its source of truth
    united-kingdom/london/london.dark.webp, london.light.webp   its card's picture, in each theme
    ukraine/kyiv/kyiv.json
    …
  src/cli.formatCity.ts                  pnpm data:format <city>
  src/cli.renderPreviews.ts              pnpm data:previews [city]
  test/unit/dataset/                     the command's helpers, and the index kept up to date
  test/unit/preview/                     the previews' helpers, and every city has its pictures
  test/unit/cities/<country>/<city>.test.ts   plays a city's history through the renderer
```

The app serves `cities/` as it is, at `/data/`: `/data/united-kingdom/london/london.json`.

## The index

`cities/cities.json` sums up each city (how many lines, stations and plans, when it opened), so the
landing page needs one small file, not every dataset: it is built into the page, which is prerendered
whole. `pnpm data:format` rewrites it; a test fails while it is out of date.

## The previews

Each city's card shows a picture of its network: the map's own basemap in the theme's colours, with
today's track over it (a network never built: its first plan, dashed). `pnpm data:previews [city]`
draws them, `<city>.dark.webp` and `<city>.light.webp` beside the dataset, in the Chrome installed on
the machine (Playwright drives it) with the renderer's `BasemapStill`; it needs the network for the
basemap's tiles. Run it after changing a city's track or its lines' colours. The pictures are
committed, as the datasets are; a test fails while a city has none.

## A dataset

`cities/<country>/<city>/<city>.json` is the city's source of truth: one line per station and per
segment of track, each segment listing its lines and the day each opened (and closed) there. Fix a
date by editing it, then `pnpm data:format <city>`; a test fails while the file is invalid or untidy.
Track and stations come from OpenStreetMap.

- `transfers`: pairs of stations, each its own stop with its own name, that passengers change
  between (Bank and Monument, Khreshchatyk and Maidan Nezalezhnosti). The map links their dots
  wherever both are open, and a station's panel lists where you can change.
- `names`: a station's, line's, network's or former name in other languages, by language code
  (`{ "uk": "Хрещатик" }`). `name` is English; a line's other names are in full ("… лінія").
  A station's other names are shown beneath its English one, on the map and in its panel.
- `plans`: futures a city may have, by id, undated: each a name, a `status` (under construction,
  planned, proposed, concept or abandoned), the lines, stations and transfers it
  would add, and its `sections` (a line through stations) in the order they would be built. A new
  station between two neighbours on a line stands on their track. The explorer offers a plan picker
  (`plan=<id>` in a link): the map shows the plan built, drawn dashed, and "Play future" builds it
  section by section from today.
- `aliases`: lines drawn as another line until a date (Circle as Metropolitan until 1949,
  Hammersmith & City until 1990, the Overground as one line until 2024).

A new city is a new dataset in the same format, then `pnpm data:format <city>` to add it to the index
and `pnpm data:previews <city>` to draw its card's pictures, plus one entry in `CITIES` (`web/app/utils/explorer.constants.ts`): it gets a card on the landing page
and its own page at `/<city>`. Its history gets a test of its own,
`test/unit/cities/<country>/<city>.test.ts` (camelCase), which plays it through the renderer.

## The cities

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

Kryvyi Rih's Metrotram, a light metro partly underground, is drawn as its two metro routes, 1M
(1986) and 2M (1999), on track from OpenStreetMap; its later hybrid routes, which run on as street
tram, are left out. Its plans are the unfinished Vovnopriadylna station, the 2021 Rokuvata extension
tender, and the 1972 project with an east–west line.

Kyiv, Kharkiv and Dnipro are in English: each station's Ukrainian name in OpenStreetMap maps to one
English name, romanised in its usual English spelling, and its earlier names (Soviet, the 2016
decommunisation, Kharkiv's 2022–24 renamings) are former names. Every station, line, network and
former name also has its Ukrainian name (`names: { "uk": … }`), which the map labels and station
panel show beneath the English one. Sviatoshyn's earlier name (Sviatoshyno, until 1991) is left out: no source gives
the day. Dnipro's extension to the centre is still unopened. Kyiv has two plans: the Varshavska extension under construction, and
the long-term plan (the unapproved 2020 draft General Plan with the Kyiv Metro's own plans), with the
Podilsko-Vyhurivska line. Dnipro has its centre extension (under construction since 2008, stopped
in 2022) and its General Plan's long-term network, with a second line. Kharkiv has the Oleksiivska line's
extension to Odeska (funded, its contract not yet signed) and its General Plan's long-term network:
every line extended, the Oleksiivska to the airport, and a fourth, Saltivsko-Zavodska line, whose
station order is laid out by geography, as no source gives it.

Some cities were never built: their dataset has no lines, stations or track, only plans, and the
explorer opens on the first. Lviv has three: the 1980s underground tram, begun around 1990; the
General Plan's light metro; and a mid-2000s proposal. Chernivtsi never planned a metro: its two plans
are unofficial concepts, one of four lines within the city, the other running them on to the towns
and villages around, with a fifth line north over the Prut and a sixth south-west to Storozhynets; the yellow line reaches Hlyboka. Their stations
stand on the places they are named after, as OpenStreetMap has them. Zaporizhzhia's is
the 2000s light-metro project, one line of 14 stations along Sobornyi Avenue. Odesa has two: the 1985
design's first line, and the two lines of the 2007 draft General Plan. Donetsk's metro was begun in
1992 and frozen: its plan is the Soviet three-line scheme, its first stage first.

London's plans are Old Oak Common, being built for HS2; the proposed Surrey Canal station, Bakerloo
line extension to Lewisham and Hayes, DLR to Thamesmead and West London Orbital; and two dropped
schemes, Crossrail 2 (safeguarded in 2015, shelved in 2020) and the Croxley Rail Link. Manchester's
are the 1970s Picc-Vic tunnel and the Bee Network's 2040 Metrolink and tram-train extensions; Tyne
and Wear's, the Metro to Washington and the 2013 extension corridors.

Glasgow's Subway is one loop of two lines, the Outer and Inner Circles, from 1896. Its closures are
suspensions: after the opening-night collision, for roof repairs in 1977, and for the 1977–80
modernisation, which moved Merkland Street's platforms to the new Partick. Its plans are the 2007–10
strategy (an East End circle, Cathcart and Maryhill) and four earlier schemes, from 1937 to 1988.

Leeds, Bristol and Liverpool never built theirs: Leeds Supertram (cancelled 2005), Bristol's
Supertram (2001–04) and the 2022 underground options, and Merseytram (funding withdrawn 2005).

Lisbon's metro opened in 1959 as one Y-shaped line, drawn as one grey network until it was split
into the Blue and Yellow lines in 1995; the Green line runs as part of the Blue until 1998, when the
Red opens. Prague's three lines date from 1974, and twelve of its stations take their present names
on 22 February 1990 (Leninova becomes Dejvická, Gottwaldova Vyšehrad). Budapest's M1 opened in 1896,
its surface end replaced in 1973; the M2, M3 and M4 follow from 1970. Warsaw's M1 opened in 1995 and
its M2 in 2015. Their plans run from line D and the M5 to pre-war and 1950s schemes. Bratislava,
Kraków and Riga never built theirs: Bratislava's 1988 metro was begun and stopped in 1990, Kraków's
is the 2025 study, and Riga's is the 1980s project's first section.

Tyne and Wear's lines are the Green and Yellow, which swapped southern branches on 12 December 2005:
until then Green ran to South Shields (from 1984) and Yellow to Sunderland and South Hylton (from
2002). The Red (Pelaw–Benton) and Blue (St James–North Shields) routes of the 1980s and 1990s are left
out: no source dates them. South Shields' move in 2019 and Meadow Well's former name (Smith's Park)
are in the dataset.
