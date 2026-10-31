# @railtime/network

A city's network through time, and every fact about it: what it is and was on any date, its lines,
stations, routes, how far one gets, how much of the city is near a station, how it grew, and each
change in words. Pure: no map, no clock; the renderer, the app, `packages/data` and the tests all ask
it (`../../ARCHITECTURE.md`).

```ts
import { NetworkFacts } from '@railtime/network/facts.service';

const facts = NetworkFacts.create(network, { plan, today }); // a plan built on it, if one is asked for
facts.range; // { start, end, today }: end is past today when a dated change is
facts.summary(); // the city summed up, for a list of cities
facts.plans(); // every plan, with what it would add
facts.lines(); // every line, its colour in both themes
facts.changes(); // every change, as its caption says it, planned ones last
facts.growth(); // the network year by year, and openings by decade
const then = facts.asOf({ cursor, time }); // the map's `time`, facts.momentOn(day), or facts.today()
then.stations(); // the stations on the map then, for a search
then.station('bank'); // its lines, when each opened and closed there, its former names, its transfers
then.line('central'); // its stops in order, by branch, its km and its changes
then.directions('bank'); // the stops either side, on each line
then.route('bank', 'oval', 'fastest');
then.reach('bank');
then.records(5);
then.stats();
facts.coverage(boundary).info(cursor); // how much of the city is within a walk of a station
facts.coverage(boundary).cells(cursor); // the same, cell by cell in its bands, for a picture
```

Behind it is `NetworkEngine` (`facts.engine`; `engine.service`, `engine.types`): the index, the
timeline and each opening's `growthOf`, the range. It is the raw network the renderer plays and draws,
and nothing else's: `web` and `data` cannot import it (ESLint). Dates, geometry and `required` are
`@railtime/core`'s. A line's colour is a `LineColor`,
`{ light, dark }`: no question takes a theme. `testing/*` exports the networks and outlines the tests
share.

A station's names in other languages (`names`) are on its label, beneath its English name, and in
`getStationInfo().otherNames`.

**Plans.** `NetworkFacts.create(network, { plan })` builds one of the network's `plans` on it
(`buildPlan` in `@railtime/schema`). A plan is undated: the timeline puts its sections after every
dated step, as `planned` steps at time `Infinity`, and the player plays them one by one once the
clock reaches its end, the clock standing there. Their track is drawn dashed in its line's colour, a
station only they reach is a ring, their `StepInfo.time` is `null`, and `TimeState.future` is true
while one plays or once one has. A different plan is a new `NetworkFacts`; `plans()` and `summary()`
are of the network as stored, whichever plan is built.

## Structure

```text
src/
├── facts/facts.service.ts     NetworkFacts: every question, for a moment given; facts.types.ts, the answers' types
├── network/                   the network and its history
│   ├── engine.service.ts      NetworkEngine: the index, the timeline, the range; engine.types.ts, the shapes the renderer sees
│   ├── index.service.ts       NetworkIndex: segments prepared, a LineSegment per (segment, line, period)
│   ├── timeline.service.ts    Timeline: the history as ordered steps; the state at any cursor
│   ├── orientation.utils.ts   a consistent direction of travel per segment
│   ├── history.utils.ts       the network year by year, openings by decade, its size at a cursor
│   └── lineDetails.utils.ts   a line's branches and length at a cursor, the stops either side of a station
├── changes/
│   ├── caption.utils.ts       a change in words: what, where, when, in its line's colour
│   └── growth.utils.ts        where a stretch grows from, and the order its stations come in (`Timeline.growthOf`)
├── route/                     RouteFinder (Dijkstra at a cursor; a reach too), the reach's bands and track
├── coverage/                  CoverageGrid and CoverageMeasure: a city's outline in cells, its share near a station
├── plan/facts.utils.ts        what a plan adds (`plans()`)
└── summary/summary.utils.ts   a network summed up, for a list of cities (`summary()`)
```

## Steps and cursors

The `Timeline` turns the network into an ordered list of steps. A **cursor** `k` means steps
`0..k-1` have happened; explore mode sits on a cursor, playback moves it one step at a time and
animates `steps[k]`. On one date the order is:

1. **identity**: lines stop being drawn as another line (`aliases` in the schema): a branch becoming
   its own line, one line splitting into several.
2. **open**: one step per line and per connected stretch, nearest the centre first. Three lines
   opening on the same day play one after another, not at once.
3. **close**: track retracts towards the end that stays on the map, leaving a dashed ghost. A line
   `suspended` on a segment closes there and opens again: each period is its
   own `LineSegment`, the reopening's caption says "reopens" and the ghost goes once the line is back.
4. **infill**: a station opening on track already drawn. One that opened after a line had left its
   track for good was never a stop on that line: no step, and the line is not listed there.
5. **stationClose**: lines stop calling at a station but keep running through it (`closed` in the
   schema). The dot fades unless another line still calls there. A line that reaches a station only
   after it closed on every line it served passes it by.
6. **rename**: a station takes a new name (`formerNames`).
   Labels and captions always use the name a station had on the date shown.

## Limits

- Distances use an equirectangular approximation at each pair of points' own latitude: fine at city
  scale anywhere, not for networks spanning hundreds of kilometres.
