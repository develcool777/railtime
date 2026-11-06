import type { Theme } from '@railtime/network/facts.types';
import type { TransitMap } from '@railtime/renderer/transitMap.service';
import type { ViewMode } from '@railtime/renderer/transitMap.types';
import type { LineId, Network, PlanId, StationId } from '@railtime/schema/network.types';
import { defineStore } from 'pinia';
import { computed, nextTick, ref } from 'vue';
import type { WritableComputedRef } from 'vue';
import { STORE_IDS } from '~/constants/store.constants';
import type { ExplorerUrlState } from '~/features/explorer/address/address.types';
import { explorerAddressOf, formatExplorerQuery } from '~/features/explorer/address/address.utils';
import { PANEL_WIDTH } from '~/features/explorer/explorer.constants';
import type { Dialog, ExplorerScreen, PanelView, Section, SheetSnap } from '~/features/explorer/explorer.types';
import {
  chromeOf,
  mapPropsOf,
  openingSectionOf,
  openLineOf,
  openStationOf,
  railSectionOf,
  viewIn,
  walkedTo,
  withStation,
  withoutStations,
} from '~/features/explorer/explorer.utils';
import { mapPaddingFor, panelCoverOf, sheetHeightOf } from '~/features/explorer/layout.utils';
import { useMapStore } from '~/features/explorer/map/map.store';
import { useNetworkStore } from '~/features/explorer/network.store';
import { useTimeStore } from '~/features/explorer/time/time.store';
import { useToolsStore } from '~/features/explorer/tools.store';
import { mapOverlayOf, overlayRequestOf, stationPickOf } from '~/features/explorer/tools.utils';

/**
 * The explorer's state, and what changes it: the one place a button or a key acts, so no click can
 * leave two parts disagreeing (`_README.md`, Where state lives).
 *
 * - **What is open**: the section and the views pushed over it, the panel and its width, the phone's
 *   sheet, map only, the dialog.
 * - **How the map is seen**: 3D, station and street names, the theme; `mapProps`, everything the map
 *   shows, and `address`, everything a link to it says, worked out from all the explorer's stores.
 * - **What spans them**: a page opening, another plan or lines shown, the map arriving, a station
 *   clicked on it; each sets the stores it touches, in order.
 *
 * It reads the network (`useNetworkStore`), the map (`useMapStore`), time (`useTimeStore`) and the
 * map's tools (`useToolsStore`), which never read it; the panel's store (`usePanelStore`) reads it.
 */
export const useExplorerStore = defineStore(STORE_IDS.EXPLORER, () => {
  const network = useNetworkStore();
  const mapStore = useMapStore();
  const timeStore = useTimeStore();
  const tools = useToolsStore();

  // ---- State
  // What is open.
  const section = ref<Section>('lines');
  /** The section a page opens on without one in its address: Plans for a plan, else Lines. */
  const openingSection = ref<Section>('lines');
  const views = ref<PanelView[]>([]);
  const phone = ref(false);
  /** A phone wide enough for its tabs' names. */
  const tabLabels = ref(false);
  const panelOpen = ref(true);
  /** Dragged for this screen, so kept for the visit only: in a link it would not fit another screen. */
  const panelWidth = ref(PANEL_WIDTH.initial);
  /** The panel's edge is being dragged. */
  const resizing = ref(false);
  const sheet = ref<SheetSnap>('peek');
  const mapOnly = ref(false);
  const dialog = ref<Dialog | null>(null);
  // How the map is seen.
  const viewMode = ref<ViewMode>('2d');
  const stationNames = ref(true);
  const streetNames = ref(true);
  /** Trains running on the lines, an illustration: off until asked for. */
  const trains = ref(false);
  /** Dark or light, as the browser keeps it. */
  const theme = ref<Theme>('dark');
  /** Where the city's outline is served, for coverage. */
  const boundaryUrl = ref('');

  // ---- Getters
  const openStation = computed(() => openStationOf(views.value));
  const openLine = computed(() => openLineOf(views.value));
  const railSection = computed(() => railSectionOf(section.value, views.value));
  const mapOverlay = computed(() => mapOverlayOf(section.value, timeStore.timeMode));
  const overlayRequest = computed(() =>
    overlayRequestOf({
      overlay: mapOverlay.value,
      routeEnds: tools.routeEnds,
      routeOption: tools.routeOption,
      reachFrom: tools.reachFrom,
      coverageMetres: tools.coverageMetres,
    }),
  );
  const chrome = computed(() =>
    chromeOf({ phone: phone.value, mapOnly: mapOnly.value, sheet: sheet.value, timeMode: timeStore.timeMode, minimap: timeStore.player.minimap }),
  );
  const sheetHeight = computed(() => (phone.value ? sheetHeightOf(sheet.value, tabLabels.value) : null));
  const panelCover = computed(() => panelCoverOf({ phone: phone.value, mapOnly: mapOnly.value, panelOpen: panelOpen.value, panelWidth: panelWidth.value }));
  /** Everything the map shows; none before the network is open. */
  const mapProps = computed(() =>
    network.facts
      ? mapPropsOf({
          facts: network.facts,
          theme: theme.value,
          viewMode: viewMode.value,
          stationNames: stationNames.value,
          streetNames: streetNames.value,
          trains: trains.value,
          timeMode: timeStore.timeMode,
          openStation: openStation.value,
          openLine: openLine.value,
          overlay: overlayRequest.value,
          boundary: tools.boundary,
          player: timeStore.player,
          padding: mapPaddingFor(sheetHeight.value),
          panelCover: panelCover.value,
        })
      : null,
  );
  /** Everything a link to what is shown says: the address's query, as the address bar is to read. */
  const address = computed(() =>
    formatExplorerQuery(
      explorerAddressOf({
        at: timeStore.linkedPlayhead,
        view: mapStore.view,
        openStation: openStation.value,
        openLine: openLine.value,
        plan: network.pickedPlan,
        section: section.value,
        openingSection: openingSection.value,
        coverageMetres: tools.coverageMetres,
        routeEnds: tools.routeEnds,
        routeOption: tools.routeOption,
        reachFrom: tools.reachFrom,
        viewMode: viewMode.value,
        stationNames: stationNames.value,
        streetNames: streetNames.value,
        trains: trains.value,
        mapOnly: mapOnly.value,
        panelOpen: panelOpen.value,
        player: timeStore.player,
      }),
    ),
  );

  // ---- Actions
  /**
   * Opens a dialog, closing any other: one at a time.
   *
   * @param next - The dialog, or `null` to close the one open.
   */
  const SET_DIALOG = (next: Dialog | null) => {
    dialog.value = next;
  };
  /**
   * Closes a dialog, if it is the one open: closing one never closes another opened meanwhile.
   *
   * @param name - The dialog.
   */
  const CLOSE_DIALOG = (name: Dialog) => {
    if (dialog.value === name) dialog.value = null;
  };
  /**
   * A dialog's open state, for its `v-model:open`: opening it closes any other, closing it leaves
   * another alone.
   *
   * @param name - The dialog.
   * @returns Whether it is open, writable through `SET_DIALOG`.
   */
  const dialogOpen = (name: Dialog): WritableComputedRef<boolean> =>
    computed({
      get: () => dialog.value === name,
      set: shown => (shown ? SET_DIALOG(name) : CLOSE_DIALOG(name)),
    });
  /** Fetches the city's outline the first time coverage is open, which measures within it. */
  const wantCoverage = () => {
    if (section.value === 'coverage') void tools.LOAD_BOUNDARY(boundaryUrl.value);
  };
  /**
   * Sets every store for a page opening, from the city's network and what the address says. A station
   * or line the network does not have is a stale link, left out.
   *
   * @param opening - The network as stored, what the address asks for, and where the city's outline is served.
   * @param opening.stored - The network, as stored.
   * @param opening.asked - What the address asks for.
   * @param opening.outline - Where the city's outline is served.
   */
  const OPEN = (opening: { stored: Network; asked: ExplorerUrlState; outline: string }) => {
    const { stored, asked, outline } = opening;
    network.OPEN(stored, asked.plan);
    const facts = network.facts;
    const line = asked.line === undefined ? null : (facts?.findLine(asked.line) ?? null);
    const station = asked.station === undefined ? null : (facts?.findStation(asked.station) ?? null);
    openingSection.value = openingSectionOf(network.pickedPlan);
    section.value = asked.section ?? openingSection.value;
    views.value = [...(line ? [{ kind: 'line' as const, id: line.id }] : []), ...(station ? [{ kind: 'station' as const, id: station.id }] : [])];
    sheet.value = 'peek';
    mapOnly.value = asked.mapOnly ?? false;
    panelOpen.value = asked.panelOpen ?? true;
    dialog.value = null;
    viewMode.value = asked.viewMode ?? '2d';
    stationNames.value = asked.stationNames ?? true;
    streetNames.value = asked.streetNames ?? true;
    trains.value = asked.trains ?? false;
    boundaryUrl.value = outline;
    mapStore.OPEN(asked.view ?? null);
    timeStore.OPEN(asked);
    tools.OPEN(asked);
    wantCoverage();
  };
  /** The network was made again: what was open stays where it still is, the tools keep their ends, and time is back on the timeline. */
  const remade = () => {
    const facts = network.facts;
    views.value = views.value.filter(open => facts && viewIn(facts, open));
    tools.KEEP_ON();
    timeStore.TO_TIMELINE();
  };
  /**
   * Shows another plan, or the network as built, on the same page and map, with the plan built (else today).
   *
   * @param shownPlan - The plan; none for the network as built.
   */
  const SHOW_PLAN = async (shownPlan: PlanId | undefined) => {
    network.SHOW_PLAN(shownPlan);
    remade();
    // Once the map has the new network (it opens at its today), on to the plan built.
    await nextTick();
    if (shownPlan) timeStore.SEEK(playheads => playheads.end());
  };
  /**
   * Shows some lines, or hides them, on the day shown.
   *
   * @param ids - The lines.
   * @param shown - Whether to show them.
   */
  const SHOW_LINES = async (ids: readonly LineId[], shown: boolean) => {
    const day = timeStore.time && !timeStore.time.atRest ? timeStore.time.time : undefined;
    network.SHOW_LINES(ids, shown);
    remade();
    // The new network opens at its today: back to the day shown, if it was another.
    await nextTick();
    if (day !== undefined) timeStore.SEEK(playheads => playheads.on(day));
  };
  /**
   * The map is mounted: it is shown where the address opened, or with the plan built.
   *
   * @param mounted - The map.
   */
  const ATTACH = (mounted: TransitMap) => {
    mapStore.ATTACH(mounted);
    timeStore.SEEK_OPENING();
  };
  /**
   * What the screen is, as the browser says.
   *
   * @param screen - A phone's or not, and wide enough for its tabs' names.
   */
  const SET_SCREEN = (screen: ExplorerScreen) => {
    phone.value = screen.phone;
    tabLabels.value = screen.tabLabels;
  };
  /**
   * Dark or light, as the browser keeps it.
   *
   * @param next - The theme.
   */
  const SET_THEME = (next: Theme) => {
    theme.value = next;
  };
  /** Brings the panel into sight: unfolds it, or raises the phone's sheet to half. */
  const REVEAL_PANEL = () => {
    if (!phone.value) panelOpen.value = true;
    else if (sheet.value === 'peek') sheet.value = 'half';
  };
  /** Folds or unfolds the panel beside the map; nothing on a phone. */
  const TOGGLE_PANEL = () => {
    if (!phone.value) panelOpen.value = !panelOpen.value;
  };
  /**
   * Folds the panel beside the map, or unfolds it.
   *
   * @param open - Unfolded.
   */
  const SET_PANEL_OPEN = (open: boolean) => {
    panelOpen.value = open;
  };
  /**
   * Starts or ends dragging the panel's edge.
   *
   * @param dragging - Being dragged.
   */
  const SET_RESIZING = (dragging: boolean) => {
    resizing.value = dragging;
  };
  /**
   * The panel's width, dragged.
   *
   * @param width - Pixels.
   */
  const SET_PANEL_WIDTH = (width: number) => {
    panelWidth.value = width;
  };
  /**
   * Where the phone's sheet rests.
   *
   * @param snap - Its height, by name.
   */
  const SET_SHEET = (snap: SheetSnap) => {
    sheet.value = snap;
  };
  /**
   * Opens a section over any pushed view, and brings the panel into sight.
   *
   * @param id - The section.
   */
  const OPEN_SECTION = (id: Section) => {
    section.value = id;
    views.value = [];
    REVEAL_PANEL();
    wantCoverage();
  };
  /**
   * A section picked on the rail: beside the map, the open section's own icon folds the panel, as an
   * editor's activity bar does; otherwise it opens.
   *
   * @param id - The section.
   */
  const PICK_SECTION = (id: Section) => {
    if (!phone.value && panelOpen.value && section.value === id && views.value.length === 0) panelOpen.value = false;
    else OPEN_SECTION(id);
  };
  /**
   * Pushes a line's view in place of any open, and brings the panel into sight.
   *
   * @param id - The line.
   */
  const PUSH_LINE = (id: LineId) => {
    views.value = [{ kind: 'line', id }];
    REVEAL_PANEL();
  };
  /**
   * Opens a station's view, picked anywhere (the map, a list, the search): over a line's, in place of
   * any walk.
   *
   * @param id - The station.
   */
  const PICK_STATION = (id: StationId) => {
    views.value = withStation(views.value, id);
    REVEAL_PANEL();
  };
  /**
   * Walks from the station open to another along its line: Back returns to the one left.
   *
   * @param id - The station.
   */
  const WALK_TO = (id: StationId) => {
    views.value = walkedTo(views.value, id);
  };
  /** Closes the stations' views, back to the line's under them, if any. */
  const CLOSE_STATION = () => {
    views.value = withoutStations(views.value);
  };
  /**
   * A station clicked on the map: with Route or Reach in sight, picked as their ends; else it opens.
   *
   * @param id - The station, or `null` for a click away from any.
   */
  const CLICK_STATION = (id: StationId | null) => {
    if (!id || !network.facts || !timeStore.time) {
      CLOSE_STATION();
      return;
    }
    const stop = { id, name: network.facts.asOf(timeStore.time).station(id).name };
    const picking = views.value.length === 0 && (phone.value || panelOpen.value);
    const pick = stationPickOf({ section: section.value, picking, routeEnds: tools.routeEnds, routeAim: tools.routeAim }, stop);
    if (pick.kind === 'route') tools.SET_ROUTE_ENDS(pick.ends);
    else if (pick.kind === 'reach') tools.SET_REACH_FROM(pick.from);
    else PICK_STATION(id);
  };
  /** Back from a pushed view: to the station walked from, the line under it, else the section. */
  const GO_BACK = () => {
    views.value = views.value.slice(0, -1);
  };
  /**
   * Enters or leaves map only; the layout takes the page full screen with it.
   *
   * @param shown - Only the map, or the page around it.
   */
  const SET_MAP_ONLY = (shown: boolean) => {
    mapOnly.value = shown;
    if (shown) dialog.value = null;
  };
  /**
   * Sees the map in 3D, or flat.
   *
   * @param mode - 3D or flat.
   */
  const SET_VIEW_MODE = (mode: ViewMode) => {
    viewMode.value = mode;
  };
  /**
   * Names the stations on the map, or shows only their dots.
   *
   * @param shown - Named.
   */
  const SET_STATION_NAMES = (shown: boolean) => {
    stationNames.value = shown;
  };
  /**
   * Runs trains on the lines, or takes them off.
   *
   * @param shown - Running.
   */
  const SET_TRAINS = (shown: boolean) => {
    trains.value = shown;
  };
  /**
   * Shows the basemap's street and place names, or the city unnamed.
   *
   * @param shown - Named.
   */
  const SET_STREET_NAMES = (shown: boolean) => {
    streetNames.value = shown;
  };

  return {
    // State
    section,
    openingSection,
    views,
    phone,
    tabLabels,
    panelOpen,
    panelWidth,
    resizing,
    sheet,
    mapOnly,
    dialog,
    viewMode,
    stationNames,
    trains,
    streetNames,
    theme,
    boundaryUrl,
    // Getters
    openStation,
    openLine,
    railSection,
    mapOverlay,
    chrome,
    sheetHeight,
    panelCover,
    mapProps,
    address,
    // Actions
    SET_DIALOG,
    CLOSE_DIALOG,
    dialogOpen,
    OPEN,
    SHOW_PLAN,
    SHOW_LINES,
    ATTACH,
    SET_SCREEN,
    SET_THEME,
    REVEAL_PANEL,
    TOGGLE_PANEL,
    SET_PANEL_OPEN,
    SET_RESIZING,
    SET_PANEL_WIDTH,
    SET_SHEET,
    OPEN_SECTION,
    PICK_SECTION,
    PUSH_LINE,
    PICK_STATION,
    WALK_TO,
    CLOSE_STATION,
    CLICK_STATION,
    GO_BACK,
    SET_MAP_ONLY,
    SET_VIEW_MODE,
    SET_STATION_NAMES,
    SET_TRAINS,
    SET_STREET_NAMES,
  };
});
