# Explorer

A city's page: the map, and everything at its edges: the header, the rail and panel, the time
control, the map's tools. `docs/redesign/README.md` says how it looks and behaves; this is a map of
the code. The reasons behind a rule sit in the comment beside the code that keeps it.

## The parts

One folder per part. Each holds its components in `components/` and, flat beside them, what they
work with: its composables, utilities, types and constants, named `<thing>.<role>.ts`.

| Part        | What                                                                                                              | Components                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `map/`      | The map: `useTransitMap` mounts it and mirrors its events; `useMapLook` tells it the store's 3D and names         | `MapTools`                                                        |
| `time/`     | The time control: at rest, the timeline, the player (`useExplorerTime`) and its settings; the timeline's scale    | `TimeControl`, `TimelineBar`, `PlayerSettings`                    |
| `panel/`    | The panel's frame: what the section and the views pushed over it list, its top (`useExplorerPanel`)               | `PanelTop`, `ExplorerRail`, `ExplorerPanel`                       |
| `lines/`    | The Lines section, and a line's view                                                                              | `LinesSection`, `LineView`                                        |
| `changes/`  | The Changes section, which follows playback                                                                       | `ChangesSection`, `ChangeTimeline`                                |
| `stations/` | The Stations section, a station's view and the walk from it along its lines; finding stations by name             | `StationsSection`, `StationView`, `StationLinks`, `StationSearch` |
| `route/`    | The Route section: a route between two stations (`useRouteFinder`)                                                | `RouteSection`                                                    |
| `insights/` | The Insights section: how the network grew, and its records on the date shown (`useInsights`)                     | `InsightsSection`, `GrowthChart`, `DecadeChart`                   |
| `reach/`    | The Reach section: how far you get from a station, by time (`useReachFinder`)                                     | `ReachSection`                                                    |
| `coverage/` | The Coverage section: how much of the city is near a station, its outline loaded on first opening (`useCoverage`) | `CoverageSection`                                                 |
| `plans/`    | The Plans section, the plan shown and its legend (`useExplorerPlan`)                                              | `PlansSection`, `PlanLegend`                                      |
| `header/`   | The header's city picker and search                                                                               | `CitySelect`, `ExplorerSearch`                                    |
| `help/`     | What you can do: the map's tools, time, the sections and the keys (`?`)                                           | `ExplorerHelp`                                                    |
| `address/`  | The address: read at opening, then kept in step with the store and the map (`useExplorerAddress`)                 | —                                                                 |

At the top, what every part shares or what ties them together:

- `explorer.store.ts` (`useExplorerStore`, Pinia): what is open and how it is set, in one place. The
  section and the views pushed over it (a line, then the stations walked), the time control's mode,
  the panel, the phone's sheet, map only, the one overlay open (search, help, cities), 3D, station
  names, the player's settings; and `chrome`, what shows around the map. Every button calls its
  actions, so no click can leave two parts disagreeing. Its rules are pure, in `explorer.utils.ts`
  (`withStation`, `walkedTo`, `chromeOf`…), and tested.
- `components/ExplorerView.vue`: the frame. It sets the store from the address, calls each part's
  composable and lays out what they give; it decides nothing itself.
- `layout.composable.ts`: what the layout takes from the browser: phone or not, the panel's edge
  dragged, full screen kept with map only; and the room the camera keeps clear of the cards.
- `shortcuts.constants.ts`: the keys, each the action a button elsewhere does; the keys listen for
  them (`shortcuts.composable.ts`) and the help lists them, from the one list.
- `explorer.types.ts`, `explorer.constants.ts`, `format.utils.ts`: the sections, the time control's
  modes, the sheet's snaps; the layout's sizes; dates and counts as the page writes them.

## Where state lives

| What                                                           | Where                         | Kept                                                                       |
| -------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| What is looked at: tab, line, station, 3D, names, map only     | the store                     | the address: `tab`, `line`, `station`, `view=3d`, `names=off`, `mapOnly=1` |
| The day, where the map looks                                   | the map (`TransitMapBinding`) | the address: `date`, `map`                                                 |
| How the page is laid out, how playback is set                  | the store                     | cookies: `railtime-panel-open`, `-panel-width`, `-player`                  |
| The rest: the time control's mode, the sheet, the overlay open | the store                     | the visit                                                                  |

## How the parts talk

- **The store** holds what is open; **the map** is one binding (`TransitMapBinding`) holding what it
  shows. A composable reads the store, reads the map for the date shown, and sends the map commands.
  The map's events come back through the binding, or into the store (a station clicked: `pickStation`).
- **A part never imports another part's composable.** What one needs from another goes through the
  store (playback opens Changes: `followPlayback`), or is handed in as a callback.
- **Components** take props and emit; none reaches into the store or a composable.

## Adding to it

- **A section**: a folder with its `<Name>Section.vue`, a line in `SECTIONS`
  (`explorer.constants.ts`), a branch in `sectionTop` (`panel/panel.utils.ts`), and its tag in
  `ExplorerView`'s panel.
- **A decision** (what the panel's top says, when the timeline opens): a pure function in the
  part's `*.utils.ts`, tested in `web/test/unit/features/explorer/<part>/`. Composables keep to
  state and wiring.
- **A key**: a line in `SHORTCUTS` (`shortcuts.constants.ts`), and its action in `shortcuts.composable.ts`, the one the button calls; the help lists it.
