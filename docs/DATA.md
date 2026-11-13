# Data

The rules a city's files keep, which the schema and each city's test hold them to. Read it before
editing a city's network, plans or outline. `CLAUDE.md` holds the code's conventions.

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
its own laid over theirs, which draws one line on top of the other. A segment's lines share one track, their trains
timed round one another's, unless it says which run on tracks of their own beside each other (`tracks`, each of its
lines on one): lines in tunnels of their own between the same two stations, a fast pair beside a stopping one.

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
