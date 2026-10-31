import { useColorMode, useCookie } from '#imports';
import { endOfYear } from '@railtime/core/date.utils';
import { NetworkFacts } from '@railtime/network/facts.service';
import type { TransitMap } from '@railtime/renderer/transitMap.service';
import type { RoutePreference, RouteStop, StepInfo, Theme } from '@railtime/network/facts.types';
import type { Credit, MapView, OverlayResult, TimeState, ViewMode } from '@railtime/renderer/transitMap.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { Network } from '@railtime/schema/network.types';
import { defineStore } from 'pinia';
import { computed, markRaw, ref, shallowRef } from 'vue';
import type { WritableComputedRef } from 'vue';

import type { ExplorerUrlState } from '~/features/explorer/address/address.types';
import { PANEL_WIDTH } from '~/features/explorer/explorer.constants';
import type { Dialog, PanelView, PlayerSettings, RouteEnds, Section, SheetSnap, TimeMode } from '~/features/explorer/explorer.types';
import {
  chromeOf,
  mapOverlayOf,
  mapPropsOf,
  openOf,
  overlayRequestOf,
  railSectionOf,
  walkedTo,
  withStation,
  withoutStations,
} from '~/features/explorer/explorer.utils';
import { mapPaddingFor, panelCoverOf } from '~/features/explorer/layout.utils';
import { DEFAULT_SPEED } from '~/features/explorer/time/time.constants';
import type { TimelineTarget } from '~/features/explorer/time/timeline.types';
import { isAtRest } from '~/features/explorer/time/time.utils';

/**
 * The explorer's state, and what changes it: the one place a button or a key acts, so no click can
 * leave two parts disagreeing (`_README.md`, Where state lives).
 *
 * - **What is open**: the section and the views pushed over it, the time control's mode, the panel,
 *   the phone's sheet, map only, the dialog; a route's ends, a reach's start, the lines shown.
 * - **How the map is seen**: 3D, station names, the player's settings; and `mapProps`, everything the
 *   map shows, worked out from all of it. The map adapter gives the map `mapProps`, and nothing else
 *   tells the map how to look.
 * - **What the map says**: the time, the change playing, what the overlay came to, where it looks:
 *   written by the adapter's listeners, read by every part.
 * - **The network**: its `NetworkFacts`, made here as the page opens, for every question about it.
 *
 * Kept by what each is: what is looked at in the address (`useExplorerAddress`), how the page is laid
 * out and how playback is set in cookies, the rest for the visit. The page mounts the explorer afresh
 * for each city and plan; `open` sets the store again from the address.
 */
export const useExplorerStore = defineStore('explorer', () => {
  const colorMode = useColorMode();

  // What is open.
  const section = ref<Section>('lines');
  const views = ref<PanelView[]>([]);
  const timeMode = ref<TimeMode>('rest');
  const phone = ref(false);
  const panelOpen = useCookie<boolean>('railtime-panel-open', { default: () => true });
  const panelWidth = useCookie<number>('railtime-panel-width', { default: () => PANEL_WIDTH.initial });
  const sheet = ref<SheetSnap>('peek');
  const mapOnly = ref(false);
  const dialog = ref<Dialog | null>(null);
  const routeEnds = ref<RouteEnds>({ from: null, to: null });
  const routePreference = ref<RoutePreference>('fastest');
  const reachFrom = ref<RouteStop | null>(null);
  const visibleLines = ref<string[] | null>(null);
  const boundary = shallowRef<CityBoundary | null>(null);

  // How the map is seen.
  const viewMode = ref<ViewMode>('2d');
  const stationNames = ref(true);
  const player = useCookie<PlayerSettings>('railtime-player', { default: () => ({ speed: DEFAULT_SPEED, camera: 'follow', minimap: true }) });

  // What the map says, and the network.
  const time = shallowRef<TimeState | null>(null);
  const step = shallowRef<StepInfo | null>(null);
  const overlayResult = shallowRef<OverlayResult | null>(null);
  const view = shallowRef<MapView | null>(null);
  const facts = shallowRef<NetworkFacts | null>(null);
  /** The map, once mounted: for its commands. */
  const map = shallowRef<TransitMap | null>(null);
  /** What the map owes credit to, once mounted. */
  const credits = shallowRef<Credit[]>([]);
  /** The day the address opened on, for the map once it is there. */
  let openingDate: number | undefined;

  /** The plan shown, if any: its future is what plays, and its built network is "at rest". */
  const plan = computed(() => facts.value?.plan ?? undefined);
  /** A network never built: no history, only its plan to play. */
  const planOnly = computed(() => facts.value?.planOnly ?? false);
  /** The city's plans, each with what it would add. */
  const plans = computed(() => facts.value?.plans() ?? []);
  const theme = computed((): Theme => (colorMode.value === 'light' ? 'light' : 'dark'));
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
  const panelCover = computed(() => panelCoverOf({ phone: phone.value, mapOnly: mapOnly.value, panelOpen: panelOpen.value, panelWidth: panelWidth.value }));
  const mapProps = computed(() =>
    mapPropsOf({
      theme: theme.value,
      viewMode: viewMode.value,
      stationNames: stationNames.value,
      visibleLines: visibleLines.value,
      timeMode: timeMode.value,
      openStation: openStation.value,
      openLine: openLine.value,
      overlay: overlayRequest.value,
      boundary: boundary.value,
      player: player.value,
      padding: mapPaddingFor(timeMode.value, phone.value, sheet.value),
      panelCover: panelCover.value,
    }),
  );

  /**
   * Sets everything for a page opening: the network's facts, and what the address says; the rest as
   * a page opens. A station or line the network does not have is a stale link, left out.
   *
   * @param network - The city's network, as stored.
   * @param shownPlan - The plan to show built on it, if any.
   * @param address - What the address asks for.
   * @param opening - The section to open on without one in the address: Plans for a plan, else Lines.
   * @returns The network's facts.
   */
  const open = (network: Network, shownPlan: string | undefined, address: ExplorerUrlState, opening: Section): NetworkFacts => {
    const opened = markRaw(NetworkFacts.create(network, shownPlan ? { plan: shownPlan } : {}));
    facts.value = opened;
    const line = address.line && opened.find('line', address.line) ? address.line : undefined;
    const station = address.station && opened.find('station', address.station) ? address.station : undefined;
    section.value = address.section ?? opening;
    views.value = [...(line ? [{ kind: 'line' as const, id: line }] : []), ...(station ? [{ kind: 'station' as const, id: station }] : [])];
    timeMode.value = 'rest';
    sheet.value = 'peek';
    mapOnly.value = address.mapOnly ?? false;
    dialog.value = null;
    routeEnds.value = { from: null, to: null };
    routePreference.value = 'fastest';
    reachFrom.value = null;
    visibleLines.value = null;
    boundary.value = null;
    viewMode.value = address.viewMode ?? '2d';
    stationNames.value = address.stationNames ?? true;
    time.value = null;
    step.value = null;
    overlayResult.value = null;
    view.value = address.view ?? null;
    openingDate = address.date;
    return opened;
  };

  /**
   * The map is mounted: it is shown where the address opened, on its day, or a plan's future.
   *
   * @param mounted - The map.
   */
  const attach = (mounted: TransitMap) => {
    map.value = markRaw(mounted);
    credits.value = mounted.credits;
    if (openingDate !== undefined) mounted.seek({ time: openingDate });
    else if (plan.value) mounted.seek('future');
  };
  /** The map is taken down. */
  const detach = () => (map.value = null);

  /**
   * The map moved through time: a date away from rest opens the timeline, so the way back is in sight.
   *
   * @param next - The time it told.
   */
  const timeChanged = (next: TimeState) => {
    time.value = next;
    if (timeMode.value === 'rest' && !isAtRest(next, plan.value !== undefined)) timeMode.value = 'timeline';
  };
  /** Playback reached its end: the timeline, at today. */
  const playbackEnded = () => {
    if (timeMode.value === 'playing') timeMode.value = 'timeline';
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

  /** Swaps where the route starts and ends. */
  const swapEnds = () => (routeEnds.value = { from: routeEnds.value.to, to: routeEnds.value.from });

  /**
   * Shows only these lines on the map; every line, when they are all of them.
   *
   * @param lines - The lines to show.
   * @param all - Every line there is.
   */
  const showLines = (lines: Set<string>, all: string[]) => (visibleLines.value = all.every(line => lines.has(line)) ? null : [...lines]);

  /**
   * Enters or leaves map only; the layout takes the page full screen with it.
   *
   * @param shown - Only the map, or the page around it.
   */
  const setMapOnly = (shown: boolean) => {
    mapOnly.value = shown;
    if (shown) dialog.value = null;
  };

  /**
   * Opens a dialog, closing any other: one at a time.
   *
   * @param next - The dialog, or `null` to close the one open.
   */
  const setDialog = (next: Dialog | null) => (dialog.value = next);
  /**
   * A dialog's open state, for its `v-model:open`: opening it closes any other, closing it leaves
   * another alone.
   *
   * @param name - The dialog.
   * @returns Whether it is open, writable.
   */
  const dialogOpen = (name: Dialog): WritableComputedRef<boolean> =>
    computed({
      get: () => dialog.value === name,
      set: shown => {
        if (shown) dialog.value = name;
        else if (dialog.value === name) dialog.value = null;
      },
    });

  /**
   * Changes how playback is set.
   *
   * @param change - The settings changed.
   */
  const setPlayer = (change: Partial<PlayerSettings>) => (player.value = { ...player.value, ...change });

  // Time: the map moves through it; the store says which card shows, and sends the map the command.

  /** The history from its start (a plan's future from today) in the player, Changes open to follow it. */
  const startPlaying = () => {
    section.value = 'changes';
    views.value = [];
    timeMode.value = 'playing';
    map.value?.play('start');
  };
  /** Opens the timeline; a network never built has no years to slide through: it plays its plan. */
  const openTimeline = () => {
    if (planOnly.value) startPlaying();
    else timeMode.value = 'timeline';
  };
  /** Closes the timeline, back to the network as it ends: today, or a plan built. */
  const closeTimeline = () => {
    timeMode.value = 'rest';
    map.value?.seek('future');
  };
  /** Opens the timeline from rest, or closes it; leaves the player alone. */
  const toggleTimeline = () => {
    if (timeMode.value === 'rest') openTimeline();
    else if (timeMode.value === 'timeline') closeTimeline();
  };
  /** Plays: on from where it paused in the player, else the history from its start. */
  const play = () => {
    if (timeMode.value === 'playing') map.value?.play();
    else startPlaying();
  };
  /** Plays or pauses. */
  const togglePlay = () => {
    if (timeMode.value === 'playing' && time.value?.playing) map.value?.pause();
    else play();
  };
  /** Leaves the player for the timeline, at the date reached, the whole network in view. */
  const exitHistory = () => {
    map.value?.stop();
    timeMode.value = 'timeline';
  };
  /**
   * Shows what the timeline was picked at: playing, it plays on from there.
   *
   * @param target - A date, a change, or the future.
   */
  const pick = (target: TimelineTarget) => {
    if (target.kind === 'future') map.value?.seek('future');
    else if (target.kind === 'change') map.value?.seek({ change: target.index });
    else map.value?.seek({ time: target.time });
  };
  /**
   * A change picked in a list: while playing, playback goes back to play it; otherwise the map shows it.
   *
   * @param index - The change.
   */
  const pickChange = (index: number) => {
    if (timeMode.value === 'playing') map.value?.play({ change: index });
    else map.value?.seek({ change: index });
  };
  /**
   * A year back or on; in the player, the change before or the next.
   *
   * @param direction - Back (-1) or on (1).
   */
  const stepTime = (direction: -1 | 1) => {
    if (planOnly.value) return;
    if (timeMode.value !== 'playing') map.value?.stepYear(direction);
    else if (direction > 0) map.value?.skip();
    else map.value?.previousChange();
  };
  /**
   * A year picked on a chart: the map at its end (today, for this year), the timeline open to say so.
   *
   * @param year - The year.
   */
  const showYear = (year: number) => {
    const today = facts.value?.range.today ?? Date.now();
    map.value?.seek({ time: Math.min(endOfYear(year), today) });
    if (timeMode.value === 'rest') openTimeline();
  };

  return {
    section,
    views,
    timeMode,
    phone,
    panelOpen,
    panelWidth,
    sheet,
    mapOnly,
    dialog,
    routeEnds,
    routePreference,
    reachFrom,
    visibleLines,
    boundary,
    viewMode,
    stationNames,
    player,
    time,
    step,
    overlayResult,
    view,
    facts,
    plan,
    planOnly,
    plans,
    map,
    credits,
    theme,
    openStation,
    openLine,
    railSection,
    playing,
    mapOverlay,
    chrome,
    panelCover,
    mapProps,
    open,
    attach,
    detach,
    timeChanged,
    playbackEnded,
    revealPanel,
    togglePanel,
    openSection,
    pickSection,
    pushLine,
    pickStation,
    walkTo,
    closeStation,
    goBack,
    swapEnds,
    showLines,
    setMapOnly,
    setDialog,
    dialogOpen,
    setPlayer,
    openTimeline,
    closeTimeline,
    toggleTimeline,
    play,
    togglePlay,
    exitHistory,
    pick,
    pickChange,
    stepTime,
    showYear,
  };
});
