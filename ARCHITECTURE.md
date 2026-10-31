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

- **A fact is asked of `network`, never worked out where it is needed.** A count, a length, a
  station's neighbours, a route, a caption, what a plan adds: `web` and `data` ask `network`. What
  stays in `web` is presentation: formatting, grouping a list A to Z, the search.
- **`schema` is the format and nothing else.** Building a plan stays in it: its validation builds every
  plan to check it fits, so `network` cannot hold it without a cycle.
- **`renderer` draws and plays, and knows nothing it can ask `network`.**
- **A helper used in two packages lives once, in `core`, the bottom of the stack.** Never a copy: a
  date, a distance, a bounding box, `clamp`, `pushTo`, `required`, and the coordinate and date types.
  Within one package, one helper too: the app's counts and numbers are `web/src/utils/format.utils.ts`.

## `network`: the facts

`NetworkFacts.create(network, { plan, today })` is a city's network as stored, its history, its plans
and every fact about them: made once, and asked by everyone. Pure: no map, no clock, so the app,
`data` and the tests use it alike, before any map exists.

```ts
const facts = NetworkFacts.create(network, { plan, today }); // the network as stored; a plan built on it, if asked for
facts.range; // { start, end, today }
facts.plan; // the plan built, or null
facts.planOnly; // never built: only plans
facts.plans(); // every plan, with what it would add
facts.summary(); // the city summed up, for a list of cities
facts.find('station', id); // { id, name }, or null
facts.lines();
facts.changes();
facts.change(index);
facts.growth();
facts.hasHistory();
facts.today(); // the questions below, for today
const then = facts.asOf(time); // time: { cursor, time }, as the map's `time` event gives it
then.stations();
then.station(id);
then.line(id);
then.directions(id);
then.records(5);
then.stats();
then.route(from, to, preference);
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

`padding`, `cover`, `theme`, `viewMode`, `stationLabels`, `visibleLines`, `focusedLines`, `speed`,
`camera`, `boundary`, `selectedStation`, `overlay` (a route, a reach, coverage).

- **The app owns them; the map never changes one.** It acts on them and reports facts as events;
  whether a fact changes a prop is the app's to decide.
- **Idempotent and order-free.** The same props again do nothing; any subset, at any time, before the
  style loads too. The map compares each with what it last applied and acts on what differs, in the
  props' own order: the room the camera keeps first, what it frames last, so nothing cancels a move.
- A prop names _what_, never _how_ or _when_: `selectedStation`, not `flyToStation`.

### Commands

```ts
seek({ time } | { change } | { beforeChange } | 'today' | 'future'); // a seek: playing, it plays on
play('here' | 'start' | { change }); // start: history's first date, or a plan's today
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
- **Given at construction**, so nothing the map says while starting is missed.
- **`time` first comes once the map is ready**, its stats the network's, never zeros.
- **An event is a fact, not a request.** `selectionGone`: the station left the map at this moment;
  its ring is hidden while it is away; the prop stays the app's.

### Lifecycle

```ts
const map = new TransitMap({ container, facts, props, on: { time, step, … }, view, minimapContainer });
```

Loading, then ready (the style loaded, the layers drawn as the props say), then destroyed (`destroy`:
the frame loop, the map, the minimap and every listener gone; any later call does nothing). Props and
commands are taken at once in any state. There is nothing else to call.

### Inside

```text
TransitMap            facade: owns MapLibre, the frame loop and the event queue; wires the rest
├─ PropsReconciler    the props, and one effect per prop, run in the props' order
├─ OverlayController  a route, a reach or coverage at the moment shown: drawn, framed when new, reported
├─ FrameRenderer      each frame on the layers; nothing sent when nothing changed
├─ CameraDirector     frames steps, follows in 3D; reads its settings from the props
├─ Player             the clock and each step's phases, moved only by its commands
└─ layers/*, Minimap  draw what they are given
```

One owner per value, inside as out; data flows one way: props and commands in, events out.
`TransitMap` takes its MapLibre map and frame scheduler from factories, so its contract is tested
whole on the stand-in map (`test/unit/transitMap.test.ts`).

## `web`: one store, one adapter

- **The store** (`features/explorer/explorer.store.ts`) holds what is open and how it is set, and
  `mapProps`, everything the map shows, worked out from it. Buttons and keys call its actions; the
  time actions send the map its commands.
- **One adapter** (`map/transitMap.composable.ts`) is the only code that touches the map: it makes it
  with `mapProps` and listeners that write what it says into the store, gives it each change of
  `mapProps`, and destroys it.
- **The store makes the facts**: `open(network, plan, address, opening)` calls `NetworkFacts.create`;
  `plan`, `planOnly` and `plans` are computeds over them.
- **The panels** are computeds over `facts.asOf(store.time)`.

## Ownership

| Fact                                               | Owner                         | Others                                |
| -------------------------------------------------- | ----------------------------- | ------------------------------------- |
| The network, its plans, its history, every answer  | `NetworkFacts` (`network`)    | —                                     |
| The clock, the cursor, playing, the step playing   | `Player` (`renderer`)         | the store: a copy from `time`, `step` |
| How the map is set (`MapProps`)                    | the store (`web`)             | `TransitMap`: the props last applied  |
| The camera between commands                        | MapLibre, and the user's hand | the store: a copy from `view`         |
| What is open: tabs, panels, dialogs, the time card | the store                     | the address, cookies                  |

## Adding a feature

| You want                                    | Do                                                                                                                              | Never                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| A number, a list, an answer about a network | a method on `NetworkFacts` (or `asOf`), tested in `network`                                                                     | working it out in `web` or `data`            |
| A setting the user sees on the map          | a field in `MapProps`, its effect in `TransitMap`, a test; in the store's `mapPropsOf`                                          | a `setX` method; a watcher in the app        |
| A new way to move through time              | a `Player` command, then a `TransitMap` command over it, a store action                                                         | the app driving the clock                    |
| Something drawn over the network            | a kind of `OverlayRequest`/`OverlayResult`, in `OverlayController`                                                              | a layer the app shows and hides by hand      |
| A new kind of change in the history         | `network`: its step in the timeline and its caption; `renderer`: a `StepAnimation` subclass and a line in `createStepAnimation` | a branch in the player or the frame          |
| Something a button opens or sets            | state and an action in the store; the button calls the action                                                                   | a ref in a component that another part reads |
