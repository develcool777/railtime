import { useCookie } from '#imports';
import type { RoutePreference, RouteStop, ViewMode } from '@railtime/renderer/transitMap.types';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { WritableComputedRef } from 'vue';

import type { ExplorerUrlState } from '~/features/explorer/address/address.types';
import { PANEL_WIDTH } from '~/features/explorer/explorer.constants';
import type { Overlay, PanelView, PlayerSettings, RouteEnds, Section, SheetSnap, TimeMode } from '~/features/explorer/explorer.types';
import { chromeOf, mapOverlayOf, openOf, overlayRequestOf, railSectionOf, walkedTo, withStation, withoutStations } from '~/features/explorer/explorer.utils';
import { DEFAULT_SPEED } from '~/features/explorer/time/time.constants';

/**
 * What the explorer has open and how it is set: the one place a button changes, so no click can leave
 * two parts disagreeing. The panel's section and the views pushed over it; the time control's mode;
 * the panel, the phone's sheet, map only; the one overlay open; a route's ends and a reach's start,
 * and what the map draws over the network from them; how the map is seen; how playback is set. What is on the map (the date, the camera, the station's details) is the map's: the composables
 * read the store and send it commands.
 *
 * Kept three ways, by what each is: what is looked at goes in the address (`useExplorerAddress`
 * writes it), how the page is laid out and how playback is set in cookies, the rest lasts the visit.
 * The page mounts the explorer afresh for each city and plan, and `open` sets it again from the address.
 */
export const useExplorerStore = defineStore('explorer', () => {
  const section = ref<Section>('lines');
  const views = ref<PanelView[]>([]);
  const timeMode = ref<TimeMode>('rest');

  const phone = ref(false);
  const panelOpen = useCookie<boolean>('railtime-panel-open', { default: () => true });
  const panelWidth = useCookie<number>('railtime-panel-width', { default: () => PANEL_WIDTH.initial });
  const sheet = ref<SheetSnap>('peek');
  const mapOnly = ref(false);
  const overlay = ref<Overlay | null>(null);

  const routeEnds = ref<RouteEnds>({ from: null, to: null });
  const routePreference = ref<RoutePreference>('fastest');
  const reachFrom = ref<RouteStop | null>(null);

  const viewMode = ref<ViewMode>('2d');
  const stationNames = ref(true);
  const player = useCookie<PlayerSettings>('railtime-player', { default: () => ({ speed: DEFAULT_SPEED, camera: 'follow', minimap: true }) });

  const openStation = computed(() => openOf(views.value, 'station'));
  const openLine = computed(() => openOf(views.value, 'line'));
  const railSection = computed(() => railSectionOf(section.value, views.value));
  const playing = computed(() => timeMode.value === 'playing');
  const mapOverlay = computed(() => mapOverlayOf(section.value, timeMode.value));
  const overlayRequest = computed(() =>
    overlayRequestOf({ overlay: mapOverlay.value, routeEnds: routeEnds.value, routePreference: routePreference.value, reachFrom: reachFrom.value }),
  );
  const chrome = computed(() =>
    chromeOf({ phone: phone.value, mapOnly: mapOnly.value, sheet: sheet.value, timeMode: timeMode.value, minimap: player.value.minimap }),
  );

  /**
   * Sets everything the address says, and the rest to how a page opens.
   *
   * @param address - What the address asks for.
   * @param opening - The section to open on without one: Plans for a plan, else Lines.
   */
  const open = (address: ExplorerUrlState, opening: Section) => {
    section.value = address.section ?? opening;
    views.value = [
      ...(address.line ? [{ kind: 'line' as const, id: address.line }] : []),
      ...(address.station ? [{ kind: 'station' as const, id: address.station }] : []),
    ];
    timeMode.value = 'rest';
    sheet.value = 'peek';
    mapOnly.value = address.mapOnly ?? false;
    overlay.value = null;
    routeEnds.value = { from: null, to: null };
    routePreference.value = 'fastest';
    reachFrom.value = null;
    viewMode.value = address.viewMode ?? '2d';
    stationNames.value = address.stationNames ?? true;
  };

  /** Brings the panel into sight: unfolds it, or raises the phone's sheet to half. */
  const revealPanel = () => {
    if (!phone.value) panelOpen.value = true;
    else if (sheet.value === 'peek') sheet.value = 'half';
  };
  /** Folds or unfolds the panel beside the map; nothing on a phone. */
  const togglePanel = () => {
    if (!phone.value) panelOpen.value = !panelOpen.value;
  };

  /**
   * Opens a section over any pushed view, and brings the panel into sight.
   *
   * @param id - The section.
   */
  const openSection = (id: Section) => {
    section.value = id;
    views.value = [];
    revealPanel();
  };
  /**
   * A section picked on the rail: beside the map, the open section's own icon folds the panel, as an
   * editor's activity bar does; otherwise it opens.
   *
   * @param id - The section.
   */
  const pickSection = (id: Section) => {
    if (!phone.value && panelOpen.value && section.value === id && views.value.length === 0) panelOpen.value = false;
    else openSection(id);
  };
  /**
   * Pushes a line's view in place of any open, and brings the panel into sight.
   *
   * @param id - The line.
   */
  const pushLine = (id: string) => {
    views.value = [{ kind: 'line', id }];
    revealPanel();
  };
  /**
   * Opens a station's view, picked anywhere (the map, a list, the search): over a line's, in place of
   * any walk.
   *
   * @param id - The station.
   */
  const pickStation = (id: string) => {
    views.value = withStation(views.value, id);
    revealPanel();
  };
  /**
   * Walks from the station open to another along its line: Back returns to the one left.
   *
   * @param id - The station.
   */
  const walkTo = (id: string) => (views.value = walkedTo(views.value, id));
  /** Closes the stations' views, back to the line's under them, if any. */
  const closeStation = () => (views.value = withoutStations(views.value));
  /** Back from a pushed view: to the station walked from, the line under it, else the section. */
  const goBack = () => (views.value = views.value.slice(0, -1));
  /** Opens Changes for playback to follow, closing any pushed view. */
  const followPlayback = () => {
    section.value = 'changes';
    views.value = [];
  };

  /** Swaps where the route starts and ends. */
  const swapEnds = () => (routeEnds.value = { from: routeEnds.value.to, to: routeEnds.value.from });

  /**
   * Enters or leaves map only; the layout takes the page full screen with it.
   *
   * @param shown - Only the map, or the page around it.
   */
  const setMapOnly = (shown: boolean) => {
    mapOnly.value = shown;
    if (shown) overlay.value = null;
  };

  /**
   * Opens an overlay, closing any other: one at a time.
   *
   * @param next - The overlay, or `null` to close the one open.
   */
  const setOverlay = (next: Overlay | null) => (overlay.value = next);
  /**
   * An overlay's open state, for its `v-model:open`: opening it closes any other, and closing it
   * leaves another alone.
   *
   * @param name - The overlay.
   * @returns Whether it is open, writable.
   */
  const overlayOpen = (name: Overlay): WritableComputedRef<boolean> =>
    computed({
      get: () => overlay.value === name,
      set: shown => {
        if (shown) overlay.value = name;
        else if (overlay.value === name) overlay.value = null;
      },
    });

  /**
   * Changes how playback is set.
   *
   * @param change - The settings changed.
   */
  const setPlayer = (change: Partial<PlayerSettings>) => (player.value = { ...player.value, ...change });

  return {
    section,
    views,
    timeMode,
    phone,
    panelOpen,
    panelWidth,
    sheet,
    mapOnly,
    overlay,
    routeEnds,
    routePreference,
    reachFrom,
    viewMode,
    stationNames,
    player,
    openStation,
    openLine,
    railSection,
    playing,
    mapOverlay,
    overlayRequest,
    chrome,
    open,
    revealPanel,
    togglePanel,
    openSection,
    pickSection,
    pushLine,
    pickStation,
    walkTo,
    closeStation,
    goBack,
    followPlayback,
    swapEnds,
    setMapOnly,
    setOverlay,
    overlayOpen,
    setPlayer,
  };
});
