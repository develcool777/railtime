# Explorer

A city's page: the map, and everything at its edges: the header, the rail and panel, the time
control, the map's tools. `docs/redesign/README.md` says how it looks and behaves; this is a map of
the code. The reasons behind a rule sit in the comment beside the code that keeps it.

## The parts

One folder per part. Each holds its components in `components/` and, flat beside them, what they
work with: its composables, utilities, types and constants, named `<thing>.<role>.ts`.

| Part        | What                                                                                                              | Components                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `map/`      | The map: `useTransitMap`, the only code that touches it (made with the store's props, given each change)          | `MapTools`                                                        |
| `time/`     | The time control: at rest, the timeline, the player and its settings (the store's time actions); the scale        | `TimeControl`, `TimelineBar`, `PlayerSettings`                    |
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
| `address/`  | The address: read at opening, then written from the store (`useExplorerAddress`)                                  | —                                                                 |

At the top, what every part shares or what ties them together:

- `explorer.store.ts` (`useExplorerStore`, Pinia): the explorer's state, and what changes it. What is
  open (the section and the views pushed over it, the time control's mode, the panel, the sheet, map
  only, the dialog, a route's ends, a reach's start, the lines shown); how the map is seen (3D, names,
  the player's settings); what the map says (the time, the change playing, what the overlay came to,
  where it looks); the network's model. `mapProps` is everything the map shows, worked out from it;
  `chrome`, what shows around the map. Every button and key calls its actions, the time ones sending
  the map its commands. Its rules are pure, in `explorer.utils.ts` (`withStation`, `chromeOf`,
  `mapPropsOf`…), and tested.
- `components/ExplorerView.vue`: the frame. It makes the network's model, opens the store on it and
  the address, calls each part's composable and lays out what they give; it decides nothing itself.
- `layout.composable.ts`: what the layout takes from the browser: phone or not, the panel's edge
  dragged, full screen kept with map only.
- `shortcuts.constants.ts`: the keys, each the action a button elsewhere does; the keys listen for
  them (`shortcuts.composable.ts`) and the help lists them, from the one list.
- `explorer.types.ts`, `explorer.constants.ts`, `format.utils.ts`: the sections, the time control's
  modes, the sheet's snaps; the layout's sizes; dates and counts as the page writes them.

## Where state lives

| What                                                          | Where                           | Kept                                                                       |
| ------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| What is looked at: tab, line, station, 3D, names, map only    | the store                       | the address: `tab`, `line`, `station`, `view=3d`, `names=off`, `mapOnly=1` |
| The day, where the map looks                                  | the map; the store a copy       | the address: `date`, `map`                                                 |
| How the page is laid out, how playback is set                 | the store                       | cookies: `railtime-panel-open`, `-panel-width`, `-player`                  |
| The rest: the time control's mode, the sheet, the dialog open | the store                       | the visit                                                                  |
| Every fact about the network                                  | the model (`@railtime/network`) | asked, never kept                                                          |

## How the parts talk

- **The store** holds what is open and what the map last said; **the model** answers every question
  about the network for the moment and theme the store has (`model.asOf(store.time, store.theme)`).
  A composable is computeds over the two: it changes when they do, and reads nothing only to re-run.
- **The map** is touched by one adapter (`useTransitMap`): it gives the map `store.mapProps`, writes
  what the map says into the store (a station clicked: `pickStation`), and destroys it.
- **A part never imports another part's composable.** What parts share is in the store (playback
  opens Changes: `startPlaying`).
- **Components** take props and emit; none reaches into the store or a composable.

## Adding to it

- **A section**: a folder with its `<Name>Section.vue`, a line in `SECTIONS`
  (`explorer.constants.ts`), a branch in `sectionTop` (`panel/panel.utils.ts`), and its tag in
  `ExplorerView`'s panel.
- **A decision** (what the panel's top says, when the timeline opens): a pure function in the
  part's `*.utils.ts`, tested in `web/test/unit/features/explorer/<part>/`. Composables keep to
  state and wiring.
- **A fact** (a count, a station's neighbours, what a plan adds): `@railtime/network`, never here.
- **Something the map shows**: a field in the store's `mapPropsOf` (and in the renderer's `MapProps`).
- **A key**: a line in `SHORTCUTS` (`shortcuts.constants.ts`), and its action in `shortcuts.composable.ts`, the one the button calls; the help lists it.
