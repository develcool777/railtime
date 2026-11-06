# @railtime/network

A city's network through time, and every fact about it: what it is and was on any date, its lines,
stations, routes, how far one gets, how much of the city is near a station, how it grew, and each
change in words. Pure: no map, no clock; the renderer, the app, `packages/data` and the tests all ask
it (`../../ARCHITECTURE.md`).

```ts
import { NetworkFacts } from '@railtime/network/facts.service';

const facts = NetworkFacts.create(network, { plan, hidden, today }); // a plan built on it, if one is asked for; lines hidden left out
facts.range; // { start, end, today }: end is past today when a dated change is
facts.summary(); // the city summed up, for a list of cities: what today().stats() counts
facts.sketch(); // each line's track open today, for a picture
facts.plans(); // every plan, with what it would add to the map today
facts.lines(); // every line, its colour in both themes
facts.changes(); // every change, as its caption says it, planned ones last
facts.growth(); // the network year by year, and openings by decade
facts.playheads.on(day); // a Playhead { cursor, time, progress }: the map's position in the history
facts.playheads.after(cursor, progress); // after so many changes, the next drawn so far; .before(cursor), .today(), .start(), .rest(), .end()
facts.playheads.hold(playhead); // its rules, in one place: the cursor to the timeline, the clock to its change's years; .dateOf(change), .isRest(), .isToday(), .inPlan()
const then = facts.asOf(playhead); // the map's `time` (a TimeState is a playhead), or one of facts.playheads; or facts.today()
then.stations(); // the stations on the map then, for a search
then.station(station); // its lines, when each opened and closed there, its former names, its transfers
then.line(line); // its stops in order, by branch, its km and its changes
then.directions(station); // the stops either side, on each line
then.routes(from, to); // up to three ways, fastest first: the fastest, the fewest changes, another way round; each ride timed as its line's trains run it
then.reach(from);
then.records(5);
then.stats(); // how many stations, km and lines: a change partway counted as far as it is drawn
then.linesOpened(); // the lines opened as themselves by then
then.trains(); // the trains it runs then
facts.coverage(boundary).info(cursor, 800); // how much of the city is within 800 m of a station (400, 800, 1200, 1600 or 2000)
facts.coverage(boundary).cells(cursor, 800); // the same, cell by cell in its bands, for a picture
facts.coverage(boundary).history(800); // the share within it, year by year
facts.coverage(boundary).stationsHeld(); // the share of its stations the outline holds
```

Behind it is `NetworkEngine` (`engineOf(facts)`; `engine.service`, `engine.types`, `engine.utils`): the
index, the timeline and each opening's `growths`, the range. It is the raw network the renderer plays and
draws, and nothing else's: `web`, `data` and `video` cannot import it (ESLint), and that import is the only way to it. Dates, geometry and `required` are
`@railtime/core`'s. A line's colour is a `LineColor`,
`{ light, dark }`: no question takes a theme. `testing/*` exports the networks and outlines the tests
share.

A station's names in other languages (`names`) are on its label, beneath its English name, and in
`then.station(id).otherNames`.

**Plans.** `NetworkFacts.create(network, { plan })` builds one of the network's `plans` on it
(`buildPlan` in `@railtime/schema`). A plan is undated: the timeline puts its sections after every
dated step, as `planned` steps at time `Infinity`, and the player plays them one by one once the
clock reaches its end, the clock standing there. Their track is drawn dashed in its line's colour, growing too, a
station only they reach is a ring, their `StepInfo.time` is `null`, and `TimeState.inPlan` is true
while one plays or once one has. A different plan is a new `NetworkFacts`; `plans()` and `summary()`
are of the network shown, its lines hidden left out, whichever plan is built.

**As the map draws it.** Every answer at a moment (`FactsAt`, `then` above) says what the map draws
then. A line drawn as another (`LineAlias`) is that line: `then.station(id)` lists it once, dated from
the first of them; `then.line(id)` gives the whole of what the map shows; a route rides them as one
line, with no change. The rule is `Timeline.drawnAs`; `Timeline.linesCallingAt` answers in its terms.

## Structure

```text
src/
├── facts/                     the front door
│   ├── facts.service.ts       NetworkFacts: the whole network's answers; facts.types.ts, the answers' types, which import nothing of the engine
│   ├── moment.service.ts      FactsAt: every question at a moment, as the map draws it then
│   ├── facts.utils.ts         what a plan adds, a sketch, a reach's bands and track, the records; facts.constants.ts, the reach's bands
│   ├── networks.utils.ts      a network with lines hidden (`withLinesHidden`), the lines to show or hide, a network never built
│   └── aliases.utils.ts       the years a line was drawn as a line hidden: its gaps, and what they cut
├── engine/                    the network through time: what NetworkEngine holds
│   ├── engine.service.ts      NetworkEngine: the index, the timeline, the range; engine.types.ts, the shapes the renderer sees
│   ├── engine.utils.ts        `engineOf`: the fenced way from a network's facts to its engine
│   ├── index.service.ts       NetworkIndex: segments prepared, a LineSegment per (segment, line, period)
│   ├── timeline.service.ts    Timeline: the history as ordered steps; the state at any cursor; what a line is drawn as, and where it calls
│   ├── growth.service.ts      Growths: how each opening grows and each closure retracts, worked out once
│   ├── timeline.utils.ts      a day's openings cut into stretches, and how a stretch grows (`Growths.growthOf`)
│   ├── days.utils.ts          every change in the network gathered by its date, before the timeline cuts it into steps
│   ├── playheads.service.ts   Playheads: where in its history the map can be, and the rules of it
│   ├── stops.service.ts       StationStops: when each line calls at each station, through its spells closed
│   ├── gaps.utils.ts          a run cut at the years its line is left out
│   ├── caption.utils.ts       a change in words: what, where, when, in its line's colour
│   ├── orientation.utils.ts   a consistent direction of travel per segment
│   ├── history.utils.ts       the network year by year, openings by decade, its size at a cursor
│   ├── lineColor.utils.ts     a line's colour in both themes
│   └── lineDetails.utils.ts   a line's track: its runs, the way they go, its hops from stop to stop, the stops either side of a station
├── route/finder.service.ts    RouteFinder: Dijkstra at a cursor, on its own priority queue, over the lines as drawn; a reach too
├── trains/                    the trains a network runs: an illustration, worked out as an operator does
│   ├── trains.service.ts      TrainService: where each train is, from the clock alone
│   ├── trains.constants.ts    TRAIN_PROFILES: how each kind of railway runs, published or fitted; a route's ride is timed from them too
│   ├── motion.utils.ts        a ride from stop to stop: pulling away, running, braking
│   ├── routes.utils.ts        every way along a line from end to end
│   └── schedule.utils.ts      a route's timetable: headways, turns, branches in turn, loops
└── coverage/                  CoverageGrid and CoverageMeasure (one file): a city's outline in cells, its share near a station
```

## Steps and cursors

The `Timeline` turns the network into an ordered list of steps. A **cursor** `k` means steps
`0..k-1` have happened; explore mode sits on a cursor, playback moves it one step at a time and
animates `steps[k]`. On one date the order is:

1. **identity**: lines stop being drawn as another line (`aliases` in the schema): a branch becoming
   its own line, one line splitting into several.
2. **open**: one step per line and per connected stretch, nearest the centre first. Three lines
   opening on the same day play one after another, not at once.
3. **infill**: a station opening on track already drawn. One that opened after a line had left its
   track for good was never a stop on that line: no step, and the line is not listed there. A station
   reopening after a spell closed (`suspended` in the schema) is an infill too, `reopening`: its caption
   says "reopens".
4. **stationClose**: lines stop calling at a station but keep running through it (`closed` in the
   schema), or stop for a spell (`suspended`: `temporary`, "closes temporarily"). The dot fades unless another line still calls there. A line that reaches a station only
   after it closed on every line it served passes it by, as does one the station says `passes`
   (a fast line on the stopping line's track): never a stop, no step. It comes before the day's
   closures: a station closes on its line while the line runs there.
5. **close**: one step per line and per connected stretch, as openings. Its track retracts as one
   front, the stretch's growth (`retreatOf`) played backwards, from its far end to the stations that
   stay on the map, over a dashed ghost of it. A line
   `suspended` on a segment closes there and opens again: each period is its
   own `LineSegment`, the reopening's caption says "reopens", and the ghost stays until the line is back;
   track closed for good leaves none.
6. **rename**: a station takes a new name (`formerNames`).
   Labels and captions always use the name a station had on the date shown.

## Limits

- Distances use an equirectangular approximation at each pair of points' own latitude: fine at city
  scale anywhere, not for networks spanning hundreds of kilometres.
