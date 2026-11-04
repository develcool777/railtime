# Architecture

How the code is divided, the contract between its parts, and the rules a change keeps. `README.md`
says how to run things; each package's `_README.md` says what is inside it. A feature that needs a
rule here broken changes this file first.

## The packages: one job each

| Package    | Job                                                                            | Depends on                               |
| ---------- | ------------------------------------------------------------------------------ | ---------------------------------------- |
| `core`     | **Helpers about nothing in rail**: dates, geometry, `required`, lists, a queue | —                                        |
| `schema`   | **The format**: a network's types, and the validation that enforces them       | core                                     |
| `network`  | **The facts**: the network through time, and every number and answer about it  | core, schema                             |
| `renderer` | **Drawing**: a network on a map, and playing its history                       | core, network, schema, MapLibre          |
| `data`     | **Storage**: every city's files, and the commands that keep them               | network (summaries), renderer (pictures) |
| `web`      | **The app**: what is open, the layout, how numbers and dates are written       | all of them                              |
| `video`    | **Videos of the app**: a page of it recorded frame by frame, as an MP4         | — (the app, served; Chrome; ffmpeg)      |

- **A fact is asked of `network`, never worked out where it is needed.** A count, a length, a
  station's neighbours, a route, a caption, what a plan adds: `web` and `data` ask `network`. What
  stays in `web` is presentation: formatting, grouping a list A to Z, the search.
- **`schema` is the format and nothing else.** Building a plan stays in it: its validation builds every
  plan to check it fits, so `network` cannot hold it without a cycle.
- **`renderer` draws and plays, and knows nothing it can ask `network`.**
- **`video` records, and knows nothing of what it records.** It takes a page of the app by its address,
  on a clock it moves a frame at a time; what a video shows is the app's, in `web`. The two meet on
  the page's `window`, in one contract `video` defines (`@railtime/video/videoPage.types`): the
  recorder's clock, and the page's handle saying when it is ready and when it is over.
- **A helper used in two packages lives once, in `core`, the bottom of the stack.** Never a copy: a
  date, a distance, a bounding box, `clamp`, `pushTo`, `required`, and the coordinate and date types.
  Within one package, one helper too: the app's counts and numbers are `web/src/utils/format.utils.ts`.

## `network`: the facts

`NetworkFacts.create(network, { plan, today })` is a city's network as stored, its history, its plans
and every fact about them: made once, and asked by everyone. Pure: no map, no clock, so the app,
`data` and the tests use it alike, before any map exists.

```ts
NetworkFacts.planToOpen(network, asked); // the plan a city opens on, before its facts are made with it
const facts = NetworkFacts.create(network, { plan, hidden, today }); // the network as stored; a plan built on it, if asked for; lines hidden left out
facts.range; // { start, end, today }
facts.plan; // the plan built, or null (none where it builds on a line hidden)
facts.hidden; // the lines hidden
facts.planOnly; // never built: only plans
facts.plans(); // every plan, with what it would add
facts.summary(); // the city summed up, for a list of cities
facts.sketch(); // each line's track today (a network never built: its first plan's), for a picture
facts.find('station', id); // { id, name }, or null
facts.lines();
facts.changes();
facts.change(index);
facts.growth();
facts.hasHistory();
facts.today(); // the questions below, for today
const then = facts.asOf(time); // time: a Playhead { cursor, time, progress }, as the map's `time` event gives it
then.stations();
then.station(id);
then.line(id);
then.directions(id);
then.records(5);
then.stats();
then.routes(from, to);
then.reach(from);
facts.coverage(boundary).info(cursor);
facts.coverage(boundary).history();
```

Every question takes the moment it is about as an argument. A Vue computed over
`facts.asOf(store.time)` changes when it does, and at no other time: nothing is read only so that
something re-runs. No answer depends on the theme: a line's colour comes in both (`LineColor`,
`{ light, dark }`), and what shows it picks one (the renderer by its `theme` prop, the app by CSS
`light-dark()`, `lineColor`).

The package has two doors, an object behind each. `NetworkFacts` (`facts.service`, `facts.types`) is
for everyone. `NetworkEngine` (`engine.service`, `engine.types`), which `NetworkFacts` builds on and
hands over as `facts.engine`, is the raw network the renderer plays and draws: the index (track,
stations), the timeline (its steps, and each opening's growth) and the dates it runs between. ESLint
keeps `web` and `data` from importing it. What the renderer draws over the network comes as answers, as the app's do: a route's
segments, a reach's `track` in its `bands`, coverage's `cells(cursor)`; it works no fact out itself.

## `renderer`: the contract

Everything an app does with the map goes through exactly one of three channels; questions go to the
network's `NetworkFacts`. A feature picks its channel by what it is.

| Channel      | What goes through it                                           | Who owns it  | Shape               |
| ------------ | -------------------------------------------------------------- | ------------ | ------------------- |
| **Props**    | How the map is set: anything the app decides and the map shows | the app      | `map.update(props)` |
| **Commands** | Moving through time; one-off camera moves                      | —            | methods             |
| **Events**   | What happened: time moving, a click, a result worked out       | the renderer | listeners           |

### Props: `update(props: Partial<MapProps>)`

`padding`, `cover`, `theme`, `viewMode`, `stationLabels`, `focusedLines`, `speed`,
`camera`, `boundary`, `selectedStation`, `overlay` (a route, a reach, coverage).

- **The app owns them; the map never changes one.** It acts on them and reports facts as events;
  whether a fact changes a prop is the app's to decide.
- **Idempotent and order-free.** The same props again do nothing; any subset, at any time, before the
  style loads too. The map compares each with what it last applied and acts on what differs, in the
  props' own order: the room the camera keeps first, what it frames last, so nothing cancels a move.
- A prop names _what_, never _how_ or _when_: `selectedStation`, not `flyToStation`.

### Commands

```ts
seek(playhead); // a Playhead { cursor, time, progress }, from facts.playheads or a TimeState; playing, it plays on
play(playhead?); // on from here, or from a playhead; at the end, again from history's start (a plan's: today)
pause();
stop(); // stop: pause, the camera back to the whole network
skip();
previousChange();
stepYear(-1 | 1);
zoomIn();
zoomOut();
fitNetwork();
jumpTo(view);
destroy();
```

Time is the renderer's: the clock moves each frame while playing. The app does not hold the date; it
hears it (`time`) and asks to move it.

### Events

`status` (`ready`), `time`, `step` (the change playing, its caption), `stepProgress`, `end`,
`stationClick`, `selectionGone`, `overlay` (what the overlay came to), `view`.

- **Delivered at the end of a frame, never inside a call.** A listener may call any method.
- **Given at construction, and only then** (`on`), so nothing the map says while starting is missed:
  the map has no `on()` to subscribe later.
- **`time` first comes once the map is ready**, its stats the network's, never zeros.
- **An event is a fact, not a request.** `selectionGone`: the station left the map at this moment;
  its ring is hidden while it is away; the prop stays the app's.

### Lifecycle

```ts
const map = new TransitMap({ container, props: { facts, … }, on: { time, step, … }, view, minimapContainer });
```

The network is a prop (`facts`), compared by instance: another (a plan shown, or none) is drawn on the
same map, its player at its today, the camera where it was, the basemap kept. Loading, then ready (the style loaded, the layers drawn as the props say), then destroyed (`destroy`:
the frame loop, the map, the minimap and every listener gone; any later call does nothing). Props and
commands are taken at once in any state. There is nothing else to call.

### Inside

```text
TransitMap            facade: owns MapLibre, the frame loop and the event queue; wires the rest
├─ PropsReconciler    the props, and one effect per prop, run in the props' order
├─ NetworkParts       what one network is drawn with, made again for another (`facts`):
│  ├─ Player             the clock and each step's phases, moved only by its commands
│  ├─ OverlayController  a route, a reach or coverage at the moment shown: drawn, framed when new, reported
│  └─ FrameRenderer      each frame on the layers; nothing sent when nothing changed
├─ CameraDirector     frames steps, follows in 3D; reads its settings from the props
└─ layers/*, Minimap  draw what they are given
```

One owner per value, inside as out; data flows one way: props and commands in, events out.
`TransitMap` takes its MapLibre map and frame scheduler from factories, so its contract is tested
whole on the stand-in map (`test/unit/transitMap.spec.ts`).

## `web`: stores, and effects

- **The stores are the one source of truth** (`features/explorer/`): every value in exactly one, with
  all worked out from it, changed only by its actions, and read one way only. `network` (the network
  shown: `NetworkFacts.create`, the plan, the lines hidden) and `map` (the map, its camera) read
  none; `time` (playback, every command through time) reads those; `tools` (route, reach, coverage)
  the network; `explorer` (what is open, how the map is seen, `mapProps`, `address`, and what spans
  them) reads all four; `panel` (what the panel shows, getters only) reads the rest. Buttons and keys
  call their actions; time's and the map store's send the map its commands.
- **Effects are composables, and hold nothing**: one makes the map with `mapProps` and listeners that
  call the stores' actions, gives it each change of `mapProps`, and destroys it
  (`map/transitMap.composable.ts`); others give the stores the screen and the theme, the keys, and
  write `address` to the address bar.

## Ownership

| Fact                                               | Owner                         | Others                               |
| -------------------------------------------------- | ----------------------------- | ------------------------------------ |
| The network, its plans, its history, every answer  | `NetworkFacts` (`network`)    | —                                    |
| The clock, the cursor, playing, the step playing   | `Player` (`renderer`)         | time's store: a copy, `time`, `step` |
| How the map is set (`MapProps`)                    | the explorer's store (`web`)  | `TransitMap`: the props last applied |
| The camera between commands                        | MapLibre, and the user's hand | the map store: a copy, `view`        |
| What is open: tabs, panels, dialogs, the time card | the explorer's and time's     | the address                          |

## Adding a feature

| You want                                    | Do                                                                                                                       | Never                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| A number, a list, an answer about a network | a method on `NetworkFacts` (or `asOf`), tested in `network`                                                              | working it out in `web` or `data`            |
| A setting the user sees on the map          | a field in `MapProps`, its effect in `TransitMap`, a test; in the explorer store's `mapPropsOf`                          | a `setX` method; a watcher in the app        |
| A new way to move through time              | a `Player` command, then a `TransitMap` command over it, a store action                                                  | the app driving the clock                    |
| Something drawn over the network            | a kind of `OverlayRequest`/`OverlayResult`, in `OverlayController`                                                       | a layer the app shows and hides by hand      |
| A new kind of change in the history         | `network`: its step in the timeline and its caption; `renderer`: its times in `STEP_TIMES` and a case in `StepAnimation` | a branch in the player or the frame          |
| Something a button opens or sets            | state and an action in the store; the button calls the action                                                            | a ref in a component that another part reads |
