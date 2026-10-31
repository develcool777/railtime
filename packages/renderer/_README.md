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
(the change animates, 1–6 s by length) and **hold** (new stations stay highlighted, ~1–2.5 s). The
clock stops on the step's date for all three. Between dates it runs at 4 years/s through quiet
periods and slows steadily to 1.2 years/s over the last years before the next change.

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
├── state/reconciler.service.ts PropsReconciler: the props, and the effect of each, in their order
├── overlay/controller.service.ts OverlayController: a route, a reach or coverage at the moment shown
├── playback/
│   ├── player.service.ts      Player: the clock and each step's phases, moved by its commands; pure
│   └── camera.service.ts      CameraDirector: framing a step; in 3D, following its line as it grows
├── steps/                     one StepAnimation per kind of step: how long it takes, what it frames, what it draws
├── layers/                    MapLayer, the network's layers, the active step, FrameRenderer, the snapshot, the basemap
├── stations/layer.service.ts  StationLayer: dots, labels, pop-in, pulses, the selection ring
├── route/  reach/  coverage/  buildings/   the layers drawn over or under the network
├── minimap/map.service.ts     Minimap: the overview inset
├── core/                      EventEmitter, easing
└── still/basemap.service.ts   BasemapStill: pictures of the basemap with a track over it, for previews
```

The player and the map only ever talk to the abstract `StepAnimation`; `createStepAnimation` is the
one place that maps a kind of step to its class.

## Limits

- Slots are per segment, so where the number of lines on the track changes, strokes can step
  sideways at a station.
