# @railtime/renderer

Draws a normalized `Network` (`@railtime/schema`) on a MapLibre basemap, as of any date, and plays
its history step by step. It owns the map and nothing else: no buttons, no captions. The app calls
methods and listens to events.

```ts
import { TransitMap } from '@railtime/renderer/transitMap.service';
import '@railtime/renderer/transitMap.css';

const map = new TransitMap({ container, network, theme: 'dark', minimapContainer });
map.on('time', state => …); // clock, cursor, stats: for a date display
map.on('step', info => …); // the change playing now: for a caption (null = hide)
map.on('stepProgress', count => …); // how many of the step's stations have appeared
map.on('stationClick', info => …); // a station's lines and dates, or null
map.on('view', view => …); // where the map looks once it stops moving: { center, zoom }

map.setDate(Date.UTC(1950, 0, 1)); // explore: the network as of a date
map.play(); // history: from the current date onwards
map.pause();
map.skip(); // finish this change, or jump to the next
map.getChanges(); // every change, described as its caption: for a list or a timeline's marks
map.showChange(12); // explore: the network just after change 12, on its date
map.playFrom(12); // history: play on from change 12
map.setVisibleLines(['line-a', 'line-b']);
map.setStationLabels(false); // dots only, no names
map.getStations(); // the stations on the map on the date shown, for a search
map.getLineDetails('line-a'); // its stops in order, by branch, its km and its changes
const route = map.findRoute('station-a', 'station-b'); // Dijkstra over the network of the date shown
map.showRoute(route); // draw it over the network, faded behind it, and frame it; showRoute(null) clears it
map.setTheme('light');
map.setView({ center: [lng, lat], zoom: 12 }); // or open there: new TransitMap({ …, view })
map.range; // { start, end, today }: end is past today when a plan is shown
```

A station's names in other languages (`names`) are on its label, beneath its English name, and in
`getStationInfo().otherNames`.

**Plans.** `new TransitMap({ …, plan: '<plan id>' })` builds one of the network's `plans` on it
(`buildPlan` in `@railtime/schema`). A plan is undated: the timeline puts its sections after every
dated step, as `planned` steps at time `Infinity`, and the player plays them one by one once the
clock reaches its end, the clock standing there. Their track is drawn dashed in its line's colour, a
station only they reach is a ring, their `StepInfo.time` is `null`, and `TimeState.future` is true
while one plays or once one has. `map.showFuture()` shows the plan built; `setDate` goes back into
the dates. A different plan is a new `TransitMap`.

## Structure

A folder per subject; inside it, files are named for what they are, not for the folder again
(`reach/layer.service.ts` holds `ReachLayer`, `reach/layer.utils.ts` its helpers). Classes keep their
full names. Whatever takes no map (`*.utils.ts`, `network/`, `route/finder`, `playback/player`,
`steps/`) runs in the unit tests as it is; the layers run there on a stand-in map
(`test/support/factories/fakeMap.utils.ts`).

```text
src/
├── transitMap.service.ts      TransitMap extends EventEmitter: the one public entry; owns the MapLibre map and composes the rest
├── core/                      nothing about rail: EventEmitter, `required`, dates, geometry, easing, a priority queue
├── network/                   the network and its history; pure
│   ├── index.service.ts       NetworkIndex: segments prepared for drawing, a LineSegment per (segment, line, period)
│   ├── timeline.service.ts    Timeline: the history as ordered steps; the state at any cursor
│   ├── orientation.utils.ts   a consistent direction of travel per segment
│   ├── history.utils.ts       the network year by year, openings by decade
│   ├── lineDetails.utils.ts   a line's branches and length at a cursor
│   └── queries.service.ts     NetworkQueries: what the app asks (lines, stations, routes, reach, records) at a moment
├── steps/                     one class per kind of step
│   ├── animation.service.ts   abstract StepAnimation: drawSeconds, holdSeconds, cameraPoints(), describe(), draw()
│   ├── open.service.ts        OpenStepAnimation: a stretch grows out of the network
│   ├── close.service.ts       CloseStepAnimation: track retracts, leaving a ghost
│   ├── infill.service.ts      InfillStepAnimation: a station opens on existing track
│   ├── stationClose.service.ts StationCloseStepAnimation: lines stop calling at a station, the track stays
│   ├── rename.service.ts      RenameStepAnimation: a station takes a new name
│   └── identity.service.ts    IdentityStepAnimation: lines take their own colour
├── playback/
│   ├── player.service.ts      Player: the clock and each step's phases; pure
│   ├── growth.utils.ts        where a stretch grows from, and the order its stations appear in
│   └── camera.service.ts      CameraDirector: framing a step
├── layers/                    what every group of map layers shares, and the network's own
│   ├── layer.service.ts       abstract MapLayer: owns its sources and layers
│   ├── network.service.ts     NetworkLayer: the network on the map, closed track as ghosts
│   ├── activeStep.service.ts  ActiveStepLayer: the playing step's track and growth heads
│   ├── frame.service.ts       FrameRenderer: each frame on the layers; sends nothing when nothing changed
│   ├── snapshot.utils.ts      what is on the map at a cursor; pure
│   ├── ids.constants.ts       the overlay's source and layer ids
│   └── basemap.utils.ts       recolouring an OpenMapTiles basemap per theme
├── stations/layer.service.ts  StationLayer: dots, labels, pop-in, pulses, selection
├── route/
│   ├── finder.service.ts      RouteFinder: Dijkstra over the network at a cursor; a reach too
│   ├── stops.utils.ts         how a route's stops are marked
│   ├── layer.utils.ts         a route's track and stops, as drawn
│   └── layer.service.ts       RouteLayer: a route over the faded network
├── reach/layer.service.ts     ReachLayer: how far one gets from a station; its bands and drawing in layer.constants.ts, layer.utils.ts
├── minimap/map.service.ts     Minimap: the overview inset
└── still/basemap.service.ts   BasemapStill: pictures of the basemap, with a track over it, for previews
```

The player and the map only ever talk to the abstract `StepAnimation`; `createStepAnimation` is the
one place that maps a kind of step to its class.

### Steps and cursors

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

### A step, frame by frame

`Player` gives each step three phases, in seconds at 1×: **pre** (the camera moves, up to 1 s, and never quicker than 0.7 s of real time; a beat where what the change touches is already in view, so the camera stays), **draw**
(the change animates, 1–6 s by length) and **hold** (new stations stay highlighted, ~1–2.5 s). The
clock stops on the step's date for all three. Between dates it runs at 4 years/s through quiet
periods and slows steadily to 1.2 years/s over the last years before the next change.

A frame draws only what changed (`FrameRenderer`): with nothing playing, nothing popping in and the same snapshot, it
sends MapLibre nothing, so an idle map costs no script time and panning stays smooth.

### Lines side by side

Where several lines share a segment, each is drawn with a `line-offset` slot (…-1, -0.5, 0, 0.5, 1…)
in the network's line order, signed by the segment's direction of travel so a line keeps its side
from one segment to the next. Lines drawn as the same line (an alias) share a slot.

## Limits

- Slots are per segment, so where the number of lines on the track changes, strokes can step
  sideways at a station.
- Distances use an equirectangular approximation at each pair of points' own latitude: fine at city
  scale anywhere, not for networks spanning hundreds of kilometres.
