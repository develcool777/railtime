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

map.setDate(Date.UTC(1950, 0, 1)); // explore: the network as of a date
map.play(); // history: from the current date onwards
map.pause();
map.skip(); // finish this change, or jump to the next
map.setVisibleLines(['victoria', 'jubilee']);
map.setTheme('light');
```

## Structure

```text
src/
├── transitMap.service.ts        TransitMap extends EventEmitter: the one public entry, composes the rest
├── core/                        EventEmitter base class, `required` lookup helper
├── model/                       pure: no map
│   ├── networkIndex.service.ts  NetworkIndex: segments prepared for drawing, a LineSegment per (segment, line)
│   ├── timeline.service.ts      Timeline: the history as ordered steps; the state at any cursor
│   └── orientation.utils.ts     a consistent direction of travel per segment
├── steps/                       one class per kind of step
│   ├── stepAnimation.service.ts abstract StepAnimation: drawSeconds, holdSeconds, cameraPoints(), describe(), draw()
│   ├── openStep.service.ts      OpenStepAnimation: a stretch grows out of the network
│   ├── closeStep.service.ts     CloseStepAnimation: track retracts, leaving a ghost
│   ├── infillStep.service.ts    InfillStepAnimation: a station opens on existing track
│   ├── stationCloseStep.service.ts StationCloseStepAnimation: lines stop calling at a station, the track stays
│   ├── renameStep.service.ts    RenameStepAnimation: a station takes a new name
│   └── identityStep.service.ts  IdentityStepAnimation: lines take their own colour
├── playback/
│   ├── player.service.ts        Player: the clock and each step's phases; pure
│   ├── growth.utils.ts          where a stretch grows from, and the order its stations appear in
│   └── camera.service.ts        CameraDirector: framing a step
├── layers/
│   ├── mapLayer.service.ts      abstract MapLayer: owns its sources and layers
│   ├── networkLayer.service.ts  NetworkLayer: the network on the map, closed track as ghosts
│   ├── activeStepLayer.service.ts ActiveStepLayer: the playing step's track and growth heads
│   ├── stationLayer.service.ts  StationLayer: dots, labels, pop-in, pulses, selection
│   ├── networkSnapshot.utils.ts what is on the map at a cursor; pure
│   └── basemap.utils.ts         recolouring an OpenMapTiles basemap per theme
└── minimap/minimap.service.ts   Minimap: the overview inset
```

The player and the map only ever talk to the abstract `StepAnimation`; `createStepAnimation` is the
one place that maps a kind of step to its class.

### Steps and cursors

The `Timeline` turns the network into an ordered list of steps. A **cursor** `k` means steps
`0..k-1` have happened; explore mode sits on a cursor, playback moves it one step at a time and
animates `steps[k]`. On one date the order is:

1. **identity**: lines stop being drawn as another line (`aliases` in the schema): Circle and
   Hammersmith & City leaving the Metropolitan, the Overground splitting into six lines.
2. **open**: one step per line and per connected stretch, nearest the centre first. Three lines
   opening on the same day play one after another, not at once.
3. **close**: track retracts towards the end that stays on the map, leaving a dashed ghost.
4. **infill**: a station opening on track already drawn (Pimlico, 1972).
5. **stationClose**: lines stop calling at a station but keep running through it (`closed` in the
   schema: Mosley Street, 2013). The dot fades unless another line still calls there.
6. **rename**: a station takes a new name (`formerNames`: G-Mex becomes Deansgate-Castlefield, 2010).
   Labels and captions always use the name a station had on the date shown.

### A step, frame by frame

`Player` gives each step three phases, in seconds at 1×: **pre** (the camera moves, 1 s), **draw**
(the change animates, 1–6 s by length) and **hold** (new stations stay highlighted, ~1–2.5 s). The
clock stops on the step's date for all three. Between dates it runs at 4 years/s through quiet
periods and 1.2 years/s approaching the next change.

### Lines side by side

Where several lines share a segment, each is drawn with a `line-offset` slot (…-1, -0.5, 0, 0.5, 1…)
in the network's line order, signed by the segment's direction of travel so a line keeps its side
from one segment to the next. Lines drawn as the same line (an alias) share a slot.

## Limits

- Slots are per segment, so where the number of lines on the track changes, strokes can step
  sideways at a station.
- Distances use an equirectangular approximation at each pair of points' own latitude: fine at city
  scale anywhere, not for networks spanning hundreds of kilometres.
