# Explorer

A city's page: the map, and everything at its edges: the header, the rail and panel, the time
control, the map's tools. `docs/redesign/README.md` says how it looks and behaves; this is a map of
the code. The reasons behind a rule sit in the comment beside the code that keeps it.

## The parts

One folder per part. Each holds its components in `components/` and, flat beside them, what they
work with: its composables, utilities, types and constants, named `<thing>.<role>.ts`.

| Part        | What                                                                                                  | Components                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `map/`      | The map: `useTransitMap` mounts it and mirrors its events; the station-names choice                   | `MapTools`                                                        |
| `time/`     | The time control: at rest, the timeline, the player (`useExplorerTime`); the timeline's scale         | `TimeControl`, `TimelineBar`                                      |
| `panel/`    | The panel's frame: the open section, the views pushed over it, its top (`useExplorerPanel`)           | `PanelTop`, `ExplorerRail`, `ExplorerPanel`                       |
| `lines/`    | The Lines section, and a line's view                                                                  | `LinesSection`, `LineView`                                        |
| `changes/`  | The Changes section, which follows playback                                                           | `ChangesSection`, `ChangeTimeline`                                |
| `stations/` | The Stations section, a station's view and the walk from it along its lines; finding stations by name | `StationsSection`, `StationView`, `StationLinks`, `StationSearch` |
| `route/`    | The Route section: a route between two stations (`useRouteFinder`)                                    | `RouteSection`                                                    |
| `insights/` | The Insights section: how the network grew, and its records on the date shown (`useInsights`)         | `InsightsSection`, `GrowthChart`, `DecadeChart`                   |
| `reach/`    | The Reach section: how far you get from a station, by time (`useReachFinder`)                         | `ReachSection`                                                    |
| `plans/`    | The Plans section, the plan shown and its legend (`useExplorerPlan`)                                  | `PlansSection`, `PlanLegend`                                      |
| `header/`   | The header's city picker and search                                                                   | `CitySelect`, `ExplorerSearch`                                    |
| `address/`  | The address: read at opening, then kept in step with the map (`useExplorerAddress`)                   | —                                                                 |

At the top, what every part shares or what ties them together:

- `components/ExplorerView.vue`: the frame. It calls each part's composable and lays out what they
  give; it decides nothing itself.
- `layout.composable.ts`: phone or not, the panel beside the map (open, width, dragged), the
  phone's sheet, map only, and the room the camera keeps clear of the cards on the map.
- `shortcuts.composable.ts`: the keys, each the action a button elsewhere does.
- `explorer.types.ts`, `explorer.constants.ts`, `format.utils.ts`: the sections, the time control's
  modes, the sheet's snaps; the layout's sizes; dates and counts as the page writes them.

## How the parts talk

- **The map** is one binding (`TransitMapBinding`): every composable that needs it takes it whole,
  and sends commands to `map.value`.
- **The time control's mode** (`timeMode`) is the one piece of state several parts read: the
  layout keeps more room under the map as the control grows, the panel's Changes follows playback,
  the route and the reach hide while it plays, the address stops following. `ExplorerView` owns it; `useExplorerTime`
  drives it.
- **A part never imports another part's composable.** What one needs from another is handed in as
  a callback: the time control calls `onPlay` (the panel's `followPlayback`), the route calls
  `openSection`. So the order of the calls in `ExplorerView` is the one place that ties them, and
  it reads top to bottom: layout, map, plan, panel, time, route, reach, insights, address, keys.
- **Components** take props and emit; none reaches into a composable.

## Adding to it

- **A section**: a folder with its `<Name>Section.vue`, a line in `SECTIONS`
  (`explorer.constants.ts`), a branch in `sectionTop` (`panel/panel.utils.ts`), and its tag in
  `ExplorerView`'s panel.
- **A decision** (what the panel's top says, when the timeline opens): a pure function in the
  part's `*.utils.ts`, tested in `web/test/unit/features/explorer/<part>/`. Composables keep to
  state and wiring.
- **A key**: a line in `shortcuts.composable.ts`, calling the action the button calls.
