# Renderer architecture

The contract between the renderer and whatever uses it, and how the renderer is built inside to
keep it. `_README.md` says how to use it; this says why it is shaped so, and the rules a change
must keep. A feature that needs a rule broken changes this file first.

## The problem this solves

The renderer grew as one class, `TransitMap`, that did three jobs at once: it drew the map, it ran
the history's clock, and it answered questions about the network. Its questions read a hidden "date
and theme now"; its display settings were half the app's and half its own; it had no stated
lifecycle. Every consumer paid for it by hand: watchers pushing each setting into the map, refs read
only so a computed re-runs on the date, guards for a map not mounted yet, re-reading after a theme
change. Each new feature added one more of those. The design below removes the reason for each.

## Three parts, one job each

```text
NetworkModel   what the network is, and was, on any date        pure: no map, no clock
Player         where in time the map is, and moving through it   pure: no map
TransitMap     draws a model at the player's moment, as told     MapLibre
```

- **`NetworkModel`** (`model/`): the network indexed, its timeline, and every question about it:
  lines, changes, a line's stops, a station's lines, the stations to search, routes, reach,
  records, growth, coverage. Each question takes the moment it is about (`{ cursor, time }`) and the
  theme (for colours) as arguments: nothing is read from anywhere else. Built from the network and
  a plan, before any map exists; the app, `packages/data` and the tests use it alike.
- **`Player`** (`playback/`): the clock, the step playing and its phases. It moves only by its
  commands and by `tick`; what happened comes back as events. Its state is private.
- **`TransitMap`**: a view. It owns the MapLibre map, the frame loop and the layers, and draws the
  model at the player's moment with the props it is given. It answers no questions about the network.

## The contract: four channels

Everything a consumer does with the map goes through exactly one of these. A feature picks its
channel by what it is, never by what is convenient.

| Channel      | What goes through it                                                | Who owns it  | Shape                         |
| ------------ | ------------------------------------------------------------------- | ------------ | ----------------------------- |
| **Props**    | How the map is set: anything the app decides and the map shows      | the app      | `map.update(props)`           |
| **Commands** | Moving through time; one-off camera moves                           | —            | methods, return nothing       |
| **Events**   | What happened on the map: time moving, a click, a result worked out | the renderer | `on(name, listener)`          |
| **Queries**  | Questions about the network                                         | the model    | `model.asOf(moment, theme).…` |

### Props: `update(props: Partial<MapProps>)`

```ts
type MapProps = {
  theme: Theme;
  viewMode: ViewMode; // flat, or 3D
  stationLabels: boolean;
  visibleLines: string[] | null; // null: every line
  focusedLines: string[] | null; // null: every line alike
  selectedStation: string | null;
  overlay: OverlayRequest | null; // a route, a reach, coverage
  boundary: CityBoundary | null; // the city's outline, which coverage is measured within
  speed: number;
  camera: CameraMode;
  padding: Padding; // room the app's cards take, kept clear when framing
  cover: Padding; // panels laid over the map's edges
};
```

- **The app owns them; the map never changes one.** The map acts on them and reports facts as
  events; whether a fact changes a prop is the app's decision.
- **Idempotent and order-free.** Giving the same props again does nothing; any subset, in any
  order, at any time: before the style loads, during playback, many times a frame. The map compares
  each field with what it last applied (`stateChanges`) and acts on what differs.
- **Complete.** The map's look is a function of its props, the model and the player's moment. Two
  maps given the same three look the same.
- A prop names _what_, never _how_ or _when_: `selectedStation`, not `flyToStation`.

### Commands

```ts
seek(to: { time: number } | { change: number } | 'today' | 'future'): void;  // keeps playing if playing
play(from?: 'here' | 'start' | { change: number }): void;   // start: history's first date, a plan's today
pause(): void;
stop(): void;                    // pause, and the camera back to the whole network
skip(): void;                    // finish the change playing, or go to the next
step(direction: -1 | 1): void;   // paused: a year; playing: the change before or after
zoomIn(): void; zoomOut(): void; fitNetwork(): void; jumpTo(view: MapView): void;
destroy(): void;
```

- **Time is the renderer's.** The clock moves every frame while playing; the app does not hold the
  date, it hears it (`time`) and asks to move it (`seek`). A command never takes a prop's place.
- A command does what it says whatever the state: `seek` while playing plays on from there, `play`
  at the end starts again, any command after `destroy` does nothing.

### Events

```ts
type TransitMapEvents = {
  status: 'loading' | 'ready' | 'destroyed';
  time: TimeState; // the clock, cursor, playing, stats: whenever any of them changes
  step: StepInfo | null; // the change playing, for a caption
  stepProgress: number; // how many of its stations have appeared
  end: undefined; // playback reached its end
  stationClick: string | null;
  selectionGone: string; // the selected station is not on the map at this moment: advice
  overlay: OverlayResult | null; // what the overlay came to, each time it is worked out
  view: MapView; // where the map looks, once it stops moving
};
```

- **Delivered from the frame loop, never inside a call.** A listener may call any method; it never
  runs while another method is half done. Events raised during a call wait for the end of the frame.
- **Listeners are given at construction** (and may be added later with `on`), so nothing the map
  says while starting is missed.
- **`time` is right from the first event**: its stats are the network's at the moment, not zeros
  before the style loads.
- An event is a fact, never a request: `selectionGone` says the station left the map; the ring is
  hidden while it is away, and the prop stays what the app made it.

### Queries: `NetworkModel`

```ts
const model = NetworkModel.create(network, { plan, today });
model.range; // { start, end, today }
model.lines(theme);
model.changes(theme);
model.growth();
const then = model.asOf(time, theme); // time: the TimeState the map last sent
then.stations();
then.station(id);
then.line(id);
then.records(5);
then.route(from, to, preference);
then.reach(from);
model.coverage(boundary).info(cursor);
model.coverage(boundary).history();
```

Pure functions of their arguments. A Vue computed over `model.asOf(time.value, theme.value)` re-runs
when the date or the theme changes because they _are_ its arguments; nothing else is needed.

### Lifecycle

```ts
const map = new TransitMap({
  container, model,
  props,                         // the whole MapProps, as the app has them now
  on: { time, step, stationClick, overlay, ... },
  view,                          // where it opens; else the whole network
  minimapContainer, basemap, workerUrl, attributionControl,
});
```

1. **Constructed**: `status` is `loading`. Props and commands are accepted at once.
2. **Ready**: the style has loaded and the layers are installed. Installing a layer draws the
   current props; there is no other "kept until ready" path. `status` becomes `ready`.
3. **Destroyed**: the frame loop stops, every MapLibre and DOM listener is removed, the minimap is
   removed, the listeners are dropped. `status` becomes `destroyed`; any later call does nothing.

There is nothing else to call to turn the map on, keep it in step or take it down.

## Ownership

Every fact has one owner. Anyone else holds at most a read-only copy that the owner refreshes.

| Fact                                                 | Owner           | Others                               |
| ---------------------------------------------------- | --------------- | ------------------------------------ |
| The network, its plan, its history, every answer     | `NetworkModel`  | —                                    |
| The clock, the cursor, playing, the step playing     | `Player`        | the app: a copy from `time`, `step`  |
| How the map is set (`MapProps`)                      | the app         | `TransitMap`: the props last applied |
| The camera between commands                          | MapLibre / user | the app: a copy from `view`          |
| The UI: tabs, panels, dialogs, which time card shows | the app         | —                                    |

## Inside `TransitMap`

```text
TransitMap            facade: owns MapLibre, the scheduler, the event queue; wires the rest
├─ PropsReconciler    stateChanges + one effect per prop
├─ OverlayController  works out the overlay at the moment, draws it, frames a new subject, reports it
├─ FrameRenderer      draws each frame on the layers; nothing sent when nothing changed
├─ CameraDirector     frames steps, follows in 3D; reads viewMode and camera from the props
├─ Player             (above)
├─ layers/*           MapLayer: install(font, props) draws the current state; update(...) after
└─ Minimap            a consumer of the frame, as the layers are
```

- **One owner per value inside too.** The view mode is a prop; the camera reads it, it does not keep
  its own. The player's speed and pre-step time are set through its methods, not its fields.
- **Data flows one way**: props and commands in → player and controllers → layers → events out.
  Nothing downstream writes upstream.
- **Testable as a whole.** `TransitMap` takes its map and frame scheduler from a factory (MapLibre
  and `requestAnimationFrame` by default); the tests give it `fakeMap` and a scheduler they step by
  hand, and check the contract: props before ready, nothing missed at start, no events inside a
  call, nothing after destroy.

## Adding a feature

| You want                               | Do                                                                 | Never                                        |
| -------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| A new setting the user sees on the map | a field in `MapProps`, its effect in the reconciler, a test        | a `setX` method; a watcher in the app        |
| A new question about the network       | a method on the model (or `at`), pure, with a test                 | a `getX` on `TransitMap`; reading the cursor |
| A new way to move through time         | a `Player` command, then a `TransitMap` command over it            | the app driving the clock                    |
| A new thing drawn over the network     | a kind of `OverlayRequest`/`OverlayResult`, in `OverlayController` | a layer the app shows and hides by hand      |
| A new kind of change in the history    | a `StepAnimation` subclass and a line in `createStepAnimation`     | a branch in the player or the frame          |
| A new look (2D/3D, theme)              | a prop the layers and camera read                                  | flags threaded through constructors          |

## On the app's side

One adapter, the only code that touches the map:

```ts
// web/src/features/explorer/map/transitMap.composable.ts
const map = new TransitMap({ container, model, props: store.mapProps, on: { time: t => (time.value = t), … } });
watch(() => store.mapProps, props => map.update(props));
onBeforeUnmount(() => map.destroy());
```

The store builds `mapProps` from what it holds (a pure `mapPropsOf`); buttons call store actions
and time commands; the panels are computeds over the model. No other code calls the map.
