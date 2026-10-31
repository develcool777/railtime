# @railtime/network

A city's network through time, and every fact about it: what it is and was on any date, its lines,
stations, routes, how far one gets, how much of the city is near a station, how it grew, and each
change in words. Pure: no map, no clock; the renderer, the app, `packages/data` and the tests all ask
it (`../../ARCHITECTURE.md`).

```ts
import { NetworkModel } from '@railtime/network/model.service';

const model = NetworkModel.create(network, { plan, today }); // a plan built on it, if one is asked for
model.range; // { start, end, today }: end is past today when a dated change is
model.lines('light'); // every line, in a theme's colours
model.changes('light'); // every change, as its caption says it, planned ones last
model.growth(); // the network year by year, and openings by decade
const then = model.asOf({ cursor, time }, 'light'); // the map's `time`, or model.momentOn(day)
then.stations(); // the stations on the map then, for a search
then.station('bank'); // its lines, when each opened and closed there, its former names, its transfers
then.line('central'); // its stops in order, by branch, its km and its changes
then.directions('bank'); // the stops either side, on each line
then.route('bank', 'oval', 'fastest');
then.reach('bank');
then.records(5);
then.stats();
model.coverage(boundary).info(cursor); // how much of the city is within a walk of a station
```

Beside the model, `networkSummary(network)` (a city summed up for a list) and `planFacts(network,
plan)` (what a plan adds). `testing/*` exports the networks and outlines the tests share.

A station's names in other languages (`names`) are on its label, beneath its English name, and in
`getStationInfo().otherNames`.

**Plans.** `NetworkModel.create(network, { plan })` builds one of the network's `plans` on it
(`buildPlan` in `@railtime/schema`). A plan is undated: the timeline puts its sections after every
dated step, as `planned` steps at time `Infinity`, and the player plays them one by one once the
clock reaches its end, the clock standing there. Their track is drawn dashed in its line's colour, a
station only they reach is a ring, their `StepInfo.time` is `null`, and `TimeState.future` is true
while one plays or once one has. A different plan is a new model.

## Structure

```text
src/
├── model/network.service.ts   NetworkModel: every question, for a moment and a theme given; facts.types.ts, the answers' types
├── network/                   the network and its history
│   ├── index.service.ts       NetworkIndex: segments prepared, a LineSegment per (segment, line, period)
│   ├── timeline.service.ts    Timeline: the history as ordered steps; the state at any cursor
│   ├── orientation.utils.ts   a consistent direction of travel per segment
│   ├── history.utils.ts       the network year by year, openings by decade, its size at a cursor
│   └── lineDetails.utils.ts   a line's branches and length at a cursor, the stops either side of a station
├── changes/
│   ├── caption.utils.ts       a change in words: what, where, when, in its line's colour
│   └── growth.utils.ts        where a stretch grows from, and the order its stations come in
├── route/                     RouteFinder (Dijkstra at a cursor; a reach too), the reach's bands
├── coverage/                  CoverageGrid and CoverageMeasure: a city's outline in cells, its share near a station
├── plan/facts.utils.ts        what a plan adds
├── summary/summary.utils.ts   a network summed up, for a list of cities
└── core/                      nothing about rail: dates, geometry, `required`, a priority queue
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
