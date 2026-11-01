# @railtime/renderer

Draws a network on a MapLibre basemap at any moment of its history, and plays that history step by
step. It owns the map and nothing else: no buttons, no captions, no facts. Every fact about the
network (a station's lines, a route, a caption) is `@railtime/network`'s. Its contract (props,
commands, events, lifecycle) is in `../../ARCHITECTURE.md`.

```ts
import { NetworkFacts } from '@railtime/network/facts.service';
import { TransitMap } from '@railtime/renderer/transitMap.service';
import '@railtime/renderer/transitMap.css';

const facts = NetworkFacts.create(network, { plan });
const map = new TransitMap({
  container,
  facts,
  props: { theme: 'dark', selectedStation: 'bank' }, // how it is set; the rest, DEFAULT_MAP_PROPS
  on: { time: state => …, step: change => …, stationClick: id => …, overlay: result => … },
  minimapContainer,
});
map.update({ viewMode: '3d', overlay: { kind: 'route', from: 'bank', to: 'oval', preference: 'fastest' } });
map.seek({ time: Date.UTC(1950, 0, 1) }); // or { change }, 'today', 'future'
map.play('start'); // history from its first date; a plan's future from today
map.pause(); map.skip(); map.previousChange(); map.stepYear(-1); map.stop();
map.destroy();
```

## A step, frame by frame

`Player` gives each step three phases, in seconds at 1×: **pre** (the camera moves, up to 1 s, and never quicker than 0.7 s of real time; a beat where what the change touches is already in view, so the camera stays), **draw**
(the change animates) and **hold** (what changed stays marked). The clock stops on the step's date
for all three. Between dates it runs at 4 years/s through quiet periods and slows steadily to 1.2
years/s over the last years before the next change.

A new stretch grows as a train runs (`steps/animation.utils.ts`): it speeds up out of a station, runs at
one pace (`GROWTH_PACE`: 2.5 km/s from above, 0.8 km/s in 3D), brakes into the next new station and
waits there a beat (0.3 s, 0.6 s in 3D). Its time is its length and its stations, never squeezed or
stretched, and every stretch, 500 m or 5 km, moves alike. A station the track only passes, opening
later, is no stop. In 3D the camera follows the front at one zoom (`CHASE_ZOOM`), so the streets pass
at the line's pace on every stretch: it sits on the line's middle over a short stretch round the
front, so a sharp bend is rounded, and faces from a little behind the front to a little ahead, so
it turns before a bend, smoothly, never in it (`chaseAlong`). The minimap, a second map, takes what
changes every frame at most ten times a second. A station reached is linked to those it changes to as the front
gets there, ringed as an interchange from then. The player's `progress` is linear: each kind of step moves through its time its own way. A renamed station is labelled with its new name over `formerly <old>`; a closing one
stays named, marked `closed`, as its dot fades and a ring closes in on it.

A frame draws only what changed (`FrameRenderer`): with nothing playing, nothing popping in and the same snapshot, it
sends MapLibre nothing, so an idle map costs no script time and panning stays smooth.

### Lines side by side

Where several lines share a segment, each is drawn with a `line-offset` slot (…-1, -0.5, 0, 0.5, 1…)
in the network's line order, signed by the segment's direction of travel so a line keeps its side
from one segment to the next. Lines drawn as the same line (an alias) share a slot.

## Lines side by side

Where several lines share a segment, each is drawn with a `line-offset` slot (…-1, -0.5, 0, 0.5, 1…)
in the network's line order, signed by the segment's direction of travel so a line keeps its side
from one segment to the next. Lines drawn as the same line (an alias) share a slot.

## Structure

A folder per subject; inside it, files are named for what they are, not for the folder again
(`reach/layer.service.ts` holds `ReachLayer`). What takes no map (`*.utils.ts`, the player, `steps/`)
runs in the unit tests as it is; the layers, and `TransitMap` whole, run on a stand-in map
(`test/support/factories/fakeMap.utils.ts`) with frames stepped by hand.

```text
src/
├── transitMap.service.ts      TransitMap: the facade; owns MapLibre, the frame loop and the event queue
├── minimap.service.ts         Minimap: the overview inset
├── playback/
│   ├── player.service.ts      Player: the clock and each step's phases, moved by its commands; pure
│   └── camera.service.ts      CameraDirector: framing a step; in 3D, following its line as it grows
├── steps/                     StepAnimation, one class for every kind of step: how long it takes, what it frames, what it
│                              draws; how a stretch grows and the camera's path along it (`animation.utils.ts`)
├── layers/                    MapLayer; the network's layers and the active step, the stations, the buildings;
│                              FrameRenderer, the snapshot, the line styles, the basemap
├── overlay/                   OverlayController, and what it draws over the network: RouteLayer, ReachLayer,
│                              CoverageLayer, and their drawing (`overlay.utils.ts`)
├── support/                   EventEmitter (the map's listeners, held private), PropsReconciler (the props and the effect of each, in order), easing and colour
└── still/basemap.service.ts   BasemapStill: pictures of the basemap with a track over it, for previews
```

The player and the map only ever talk to `StepAnimation`, one class for every kind of step: each kind's
times are a row of `STEP_TIMES` (an opening's, its stretch's), and `cameraPoints` and `draw` a case each.

## Limits

- Slots are per segment, so where the number of lines on the track changes, strokes can step
  sideways at a station.
