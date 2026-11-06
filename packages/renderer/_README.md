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
  props: { facts, theme: 'dark', selectedStation: 'bank' }, // the network and how it is set; the rest, DEFAULT_MAP_PROPS
  on: { time: state => …, step: change => …, stationClick: id => …, overlay: result => … },
  minimapContainer,
});
map.update({ viewMode: '3d', overlay: { kind: 'route', from: 'bank', to: 'oval', option: 0 } });
map.update({ facts: NetworkFacts.create(network, { plan: 'another' }), arrival: null }); // drawn on the same map, where it rests: `arrival`, a moment, says otherwise
map.seek(facts.playheads.on(Date.UTC(1950, 0, 1))); // any Playhead: .after(cursor, progress), .before(cursor), .today(), .end(), a TimeState
map.play(); // on from here; at the end, again from history's first date (a plan's: today); or play(playhead)
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
it turns before a bend, smoothly, never in it (`chaseAlong`). The minimap, a second map, takes the line
growing at most thirty times a second, and outlines the camera's view with an element over it, placed every frame. A station reached is linked to those it changes to as the front
gets there, ringed as an interchange from then. A closed stretch plays the same way backwards
(`retreatOf`): one front retracts from its far end to the network that stays, at the same pace,
over the dashed ghost of what closes (a suspended stretch's ghost stays until its line is back; one closed for good goes), the stretch standing whole until the front starts on it, the 3D camera following it facing the way it runs, and each
station it takes off the map fading while the front stops there. A plan's stretch grows dashed, as
the map draws a plan (`planned` on its features). The player's `progress` is linear: each kind of step moves through its time its own way. A renamed station is labelled with its new name over `formerly <old>`; a closing one
stays named, marked `closed` (`closed for now` for a spell, `reopened` as it returns), as its dot fades and a ring closes in on it.

What a step does to the network under it is the step's to say, by phase (`StepAnimation.baseAt`, a `BaseNetwork`):
what the network leaves out, what makes room, and how far lines have blended. The snapshot is built by that answer
and knows no kind of step: a closure takes its stretch out as it starts retracting, an opening has the track make
room from the start, an identity step gives a blend as it draws.

A frame draws only what changed (`FrameRenderer`): the snapshot is built again when the cursor or the theme moved or
when the step's answer differs (`sameBase`: a blend only as its value changes), and the step drawn again only once it
moved. With nothing playing, or paused in a change, nothing popping in and the same snapshot, it sends MapLibre
nothing, so an idle map costs no script time and panning stays smooth.

Every `setData` has MapLibre cut that source's tiles again, in a worker, for every tile in view: at
street level in 3D, a score of them. So while a line grows:

- the overlay's sources are cut no closer than zoom 14 (`OVERLAY_SOURCE_MAX_ZOOM`), the growing piece
  13: within a metre, a few tiles in view;
- the track drawn whole is sent only as a segment is done; each frame, only the piece still growing
  and its head (`growing`), a few metres;
- a source is sent only when what it holds changed; the highlight's fade is a paint value;
- a station's or a ring's look (pop-in, fade, a ring growing) is feature state, never data: the
  stations are sent only when one is added, gone, or shows something new;
- the minimap takes all it is given at most thirty times a second (`MINIMAP_UPDATE_MS`), by the frames' own clock
  (`Minimap.flush(now)`), never a timer: a recorder's clock moves the frames, and the inset with them;
- as a step's camera move ends, it waits for the tiles where it arrived (`MAX_TILE_WAIT_SECONDS`), so
  the line grows over drawn streets, not a blank filling in.

## Lines side by side

Where several lines share a segment, each is drawn with a `line-offset` slot (…-1, -0.5, 0, 0.5, 1…)
in the network's line order, signed by the segment's direction of travel so a line keeps its side
from one segment to the next. Lines drawn as the same line (an alias) share a slot.

## Structure

A folder per subject; inside it, files are named for what they are, not for the folder again
(`overlay/reach.service.ts` holds `ReachLayer`). What takes no map (`*.utils.ts`, the player, `steps/`)
runs in the unit tests as it is; the layers, the minimap, `BasemapStill` and `TransitMap` whole run on a
stand-in map (`test/support/factories/fakeMap.utils.ts`, given as their `createMap`) with frames stepped
by hand; what adds elements of its own (the minimap, `BasemapStill`) in happy-dom, as `*.spec.ts`.

```text
src/
├── transitMap.service.ts      TransitMap: the facade; owns MapLibre, the props, the frame loop and the event queue,
│                              and hands each command and effect to the part whose job it is
├── transitMap.utils.ts        Where a network's map stands as it comes (`arrivalPlayhead`), what `time` says of a
│                              playhead, and of a network just given (`arrivalTimeOf`, for the app); no map
├── minimap/                   Minimap: the overview inset, and the box over it following the main camera's view
│                              (`minimap.utils.ts` places it)
├── playback/
│   ├── playback.service.ts    Playback: the history played on the map, each frame, each command and each jump: the
│   │                          clock moved on (held for the tiles), each change framed and captioned, the moment drawn,
│   │                          reported; another network or view taken up; it holds what one network is drawn with
│   ├── player.service.ts      Player: the clock and each step's phases, moved by its commands; pure
│   └── camera.service.ts      CameraDirector: every move of the camera: where it opens (`camera.utils.ts`), the panels
│                              over the edges, one-off moves, framing a step; in 3D, following its line as it grows
├── steps/                     StepAnimation, one class for every kind of step: how long it takes, what it frames, what it
│                              asks of the network under it, what it draws; how a stretch grows and the camera's path
│                              along it (`animation.utils.ts`)
├── layers/                    MapLayers (`stack.service.ts`): the groups in their order, installed and themed together;
│                              MapLayer; the network's layers and the active step, the stations, the buildings;
│                              FrameRenderer, the snapshot, the line styles, the basemap
├── overlay/                   OverlayController, and what it draws over the network: RouteLayer, ReachLayer,
│                              CoverageLayer, and their drawing (`overlay.utils.ts`)
├── support/                   EventEmitter (the map's listeners, held private), PropsReconciler (the props and the effect of each, in order), easing and colour
└── still/basemap.service.ts   BasemapStill: pictures of the basemap with a track over it, for previews
```

The player and the map only ever talk to `StepAnimation`, one class for every kind of step: each kind's
times are a row of `STEP_TIMES` (an opening's or a closure's, its stretch's), and `cameraPoints`, `baseAt` and `draw` a case each.

## Limits

- Slots are per segment, so where the number of lines on the track changes, strokes can step
  sideways at a station.
