# Explorer

A city's page: the map, and everything at its edges: the header, the rail and panel, the time
control, the map's tools. `docs/redesign/README.md` says how it looks and behaves; this is a map of
the code. The reasons behind a rule sit in the comment beside the code that keeps it.

## The parts

One folder per part. Each holds its components in `components/` and, flat beside them, what they
work with: its composables, utilities, types and constants, named `<thing>.<role>.ts`.

| Part        | What                                                                                                                                                     | Components                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `map/`      | The map: its store (`useMapStore`: the map, its credits, where it looks, its camera), and `useTransitMap`, which makes it and takes it down              | `MapTools`                                                                      |
| `time/`     | Time: its store (`useTimeStore`), and the time control: one card, the timeline or the player, the player's settings; the scale                           | `TimeControl`, `TimelineBar`, `PlayerSettings`                                  |
| `panel/`    | The panel's frame, and its store (`usePanelStore`, getters only): the station or line open, the panel's top, records, the plan shown, each section's dot | `PanelTop`, `ExplorerRail`, `ExplorerPanel`, `PanelSearch`                      |
| `lines/`    | The Lines section, and a line's view                                                                                                                     | `LinesSection`, `LineView`                                                      |
| `changes/`  | The Changes section, which follows playback and is searched by line, station or year                                                                     | `ChangesSection`, `ChangeTimeline`                                              |
| `stations/` | The Stations section, a station's view and the walk from it along its lines; finding stations by name                                                    | `StationsSection`, `StationView`, `StationLinks`, `StationField`, `MapPickHint` |
| `route/`    | The Route section: up to three ways between two stations, picked here or on the map, and the one drawn leg by leg                                        | `RouteSection`                                                                  |
| `insights/` | The Insights section: how the network grew, and its records on the date shown                                                                            | `InsightsSection`, `GrowthChart`, `DecadeChart`                                 |
| `reach/`    | The Reach section: how far you get from a station, by time                                                                                               | `ReachSection`                                                                  |
| `coverage/` | The Coverage section: how much of the city is near a station, its outline loaded on first opening (`LOAD_BOUNDARY`)                                      | `CoverageSection`                                                               |
| `plans/`    | The Plans section, the plan shown and its legend                                                                                                         | `PlansSection`, `PlanLegend`                                                    |
| `header/`   | The header's city picker and search                                                                                                                      | `CitySelect`, `ExplorerSearch`                                                  |
| `help/`     | What you can do: the map's tools, time, the sections and the keys (`?`)                                                                                  | `ExplorerHelp`                                                                  |
| `address/`  | The address: read at opening, then written from the explorer's `address` (`useExplorerAddress`)                                                          | —                                                                               |

At the top, what every part shares or what ties them together. **The stores are the one source of
truth**: every value in one, with all worked out from it, changed only by its actions, and read one
way only (CLAUDE.md, Architecture):

- `network.store.ts` (`useNetworkStore`): the network shown. The city's network as stored, the plan
  picked, and the facts made from them with the lines hidden left out (`OPEN`, `SHOW_PLAN`,
  `SHOW_LINES`): every question about it. Reads no store.
- `map/map.store.ts` (`useMapStore`): the map, once mounted, its credits and where it looks; its
  camera's commands (`ZOOM_IN`, `FIT_NETWORK`). Reads no store.
- `time/time.store.ts` (`useTimeStore`): the time control's mode (the timeline, or the player:
  `playerShown`; the map moving is `time.playing`), how playback is set, where the history is and the
  change playing, as the map tells them; every command through time (`PLAY`, `SEEK`, `PICK`,
  `STEP_TIME`…), sent to the map. Reads the network and the map.
- `tools.store.ts` (`useToolsStore`): the map's tools. A route's ends and the way drawn, the end a
  station clicked on the map fills (`routeAim`), a reach's start, coverage's distance, the city's
  outline and where its fetch stands (`LOAD_BOUNDARY`), and what the map found for the one drawn
  (`foundRoutes`, `foundReach`, `coverage`). Its rules are in `tools.utils.ts`. Reads the network.
- `explorer.store.ts` (`useExplorerStore`): what is open (the section and the views pushed over it,
  the panel, the sheet, map only, the dialog) and how the map is seen (3D, names, the theme);
  `mapProps`, everything the map shows, `address`, everything a link says, and `chrome`, what shows
  around the map, from every store; and the actions that span them: a page opening (`OPEN`), another
  plan or lines (`SHOW_PLAN`, `SHOW_LINES`, keeping the day shown), the map arriving (`ATTACH`), a
  station clicked (`CLICK_STATION`). Its rules are in `explorer.utils.ts`. Reads the four above.
- `panel/panel.store.ts` (`usePanelStore`): getters only, what the panel shows. Nothing reads it.
- `components/ExplorerView.vue`: the frame. It opens the stores on the network and the address, starts the effects, and lays out what the stores hold; it decides nothing itself.
- The effects, each a composable that ties something outside Vue to the stores and holds nothing:
  `layout.composable.ts` (the screen and the theme in, full screen with map only, the panel's edge
  dragged), `map/transitMap.composable.ts` (the map made and taken down), `shortcuts.composable.ts`
  (the keys), `address/address.composable.ts` (the address bar, written from `address`).
- `shortcuts.constants.ts`: the keys, each the action a button elsewhere does; the keys listen for
  them (`shortcuts.composable.ts`) and the help lists them, from the one list.
- `explorer.types.ts`, `explorer.constants.ts`, `format.utils.ts`: the sections, the time control's
  modes, the sheet's snaps; the layout's sizes; dates and counts as the page writes them.

## Where state lives

| What                                                          | Where                      | Kept                                                                       |
| ------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| What is looked at: tab, line, station, 3D, names, map only    | the explorer's store       | the address: `tab`, `line`, `station`, `view=3d`, `names=off`, `mapOnly=1` |
| The plan picked, the lines hidden                             | the network's store        | the visit                                                                  |
| A route's ends and the way drawn, a reach's start             | the tools' store           | the address: `route=bank,oval` (`,1`: the second way), `reach=bank`        |
| How far from a station coverage counts                        | the tools' store           | the address: `walk=400`, `1200`, `1600` or `2000` (800 m without)          |
| The playhead; where the map looks                             | time's store; the map's    | the address: `at` (`202`, `202.4`, `202,1928-06-01`), `map`                |
| How playback is set; the panel folded                         | time's; the explorer's     | the address: `speed=4`, `camera=free`, `minimap=off`, `panel=off`          |
| The panel's width, dragged for this screen                    | the explorer's store       | the visit                                                                  |
| Dark or light                                                 | Nuxt's colour mode → store | the browser (localStorage), the one preference kept                        |
| The rest: the time control's mode, the sheet, the dialog open | time's; the explorer's     | the visit                                                                  |
| Every fact about the network                                  | `NetworkFacts` (`network`) | asked, never kept                                                          |

## How the parts talk

- **The stores** hold everything; **the facts** answer every question about the network for the
  moment time's store has (`facts.asOf(time)`). A line's colour comes in both themes; `lineColor`
  (`~/utils/format.utils.ts`, the video's too) makes it CSS that follows the page's.
- **The map** is made and taken down by one effect (`useTransitMap`): it gives the map `mapProps`
  and calls the stores' actions with what the map says (a station clicked: `CLICK_STATION`; the time:
  `SET_TIME`). Commands reach the map only through actions: time's, and the map store's camera.
- **Components** take props and emit; the frame hands them the stores' values and their events to
  the stores' actions.

## Adding to it

- **A section**: a folder with its `<Name>Section.vue`, a line in `SECTIONS`
  (`explorer.constants.ts`), a branch in `sectionTop` (`panel/panel.utils.ts`), and its tag in
  `ExplorerView`'s panel.
- **A decision** (what the panel's top says, when the timeline opens): a pure function in the
  part's `*.utils.ts`, tested in `web/test/unit/features/explorer/<part>/`, used by a store's getter
  or action. A value goes in the one store that owns it; a composable holds none.
- **A fact** (a count, a station's neighbours, what a plan adds): `@railtime/network`, never here.
- **Something the map shows**: a field in the explorer store's `mapPropsOf` (and in the renderer's `MapProps`).
- **A key**: a line in `SHORTCUTS` (`shortcuts.constants.ts`), and its action in `shortcuts.composable.ts`, the one the button calls; the help lists it.
