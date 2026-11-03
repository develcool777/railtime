import { useColorMode } from '#imports';
import { endOfYear } from '@railtime/core/date.utils';
import { NetworkFacts } from '@railtime/network/facts.service';
import type { TransitMap } from '@railtime/renderer/transitMap.service';
import type { Playhead, StepInfo, Theme } from '@railtime/network/facts.types';
import type { Credit, MapView, TimeState, ViewMode } from '@railtime/renderer/transitMap.types';
import type { Network } from '@railtime/schema/network.types';
import { defineStore } from 'pinia';
import { computed, markRaw, nextTick, ref, shallowRef } from 'vue';
import type { WritableComputedRef } from 'vue';

import type { ExplorerUrlState, LinkedPlayhead } from '~/features/explorer/address/address.types';
import { playheadOf } from '~/features/explorer/address/address.utils';
import { PANEL_WIDTH } from '~/features/explorer/explorer.constants';
import type { Dialog, PanelView, PlayerSettings, Section, SheetSnap, TimeMode } from '~/features/explorer/explorer.types';
import { chromeOf, mapPropsOf, openOf, railSectionOf, walkedTo, withStation, withoutStations } from '~/features/explorer/explorer.utils';
import { useToolsStore } from '~/features/explorer/tools.store';
import { mapOverlayOf, overlayRequestOf, stationPickOf } from '~/features/explorer/tools.utils';
import { mapPaddingFor, panelCoverOf, sheetHeightOf } from '~/features/explorer/layout.utils';
import { DEFAULT_PLAYER } from '~/features/explorer/time/time.constants';
import type { TimelineTarget } from '~/features/explorer/time/timeline.types';

/**
 * The explorer's state, and what changes it: the one place a button or a key acts, so no click can
 * leave two parts disagreeing (`_README.md`, Where state lives).
 *
 * - **What is open**: the section and the views pushed over it, the time control's mode, the panel,
 *   the phone's sheet, map only, the dialog; the lines shown. The map's tools (a route, a reach,
 *   coverage) are a store of their own (`useToolsStore`), read here for the map.
 * - **How the map is seen**: 3D, station names, the player's settings; and `mapProps`, everything the
 *   map shows, worked out from all of it. The map adapter gives the map `mapProps`, and nothing else
 *   tells the map how to look.
 * - **What the map says**: the time, the change playing, what the overlay came to, where it looks:
 *   written by the adapter's listeners, read by every part.
 * - **The network**: its `NetworkFacts`, made here as the page opens, for every question about it.
 *
 * Kept by what each is: what is looked at and how it is set in the address (`useExplorerAddress`), the
 * panel's width for the visit, dark or light in the browser. The page mounts the explorer afresh
 * for each city and plan; `open` sets the store again from the address.
 */
export const useExplorerStore = defineStore('explorer', () => {
  const colorMode = useColorMode();
  const tools = useToolsStore();

  // What is open.
  const section = ref<Section>('lines');
  const views = ref<PanelView[]>([]);
  const timeMode = ref<TimeMode>('timeline');
  const phone = ref(false);
  // A phone wide enough for its tabs' names.
  const tabLabels = ref(false);
  const panelOpen = ref(true);
  // Dragged for this screen, so kept for the visit only: in a link it would not fit another screen.
  const panelWidth = ref(PANEL_WIDTH.initial);
  const sheet = ref<SheetSnap>('peek');
  const mapOnly = ref(false);
  const dialog = ref<Dialog | null>(null);

  // How the map is seen.
  const viewMode = ref<ViewMode>('2d');
  const stationNames = ref(true);
  const streetNames = ref(true);
  const player = ref<PlayerSettings>({ ...DEFAULT_PLAYER });

  // What the map says, and the network.
  const time = shallowRef<TimeState | null>(null);
  const step = shallowRef<StepInfo | null>(null);
  const view = shallowRef<MapView | null>(null);
  const facts = shallowRef<NetworkFacts | null>(null);
  /** The city's network as stored, every plan and line in it: its facts are made from it, its lines hidden left out. */
  const network = shallowRef<Network | null>(null);
  /** The map, once mounted: for its commands. */
  const map = shallowRef<TransitMap | null>(null);
  /** What the map owes credit to, once mounted. */
  const credits = shallowRef<Credit[]>([]);
  /** Where in the history the address opened, for the map once it is there. */
  let openingPlayhead: LinkedPlayhead | undefined;

  /** The plan picked, if any: shown while every line it builds on is, and kept in the address either way. */
  const pickedPlan = ref<string | undefined>(undefined);
  /** The plan shown, if any: its changes are what plays, and the network it builds is "at rest". */
  const plan = computed(() => facts.value?.plan ?? undefined);
  /** Each network with the lines that may be shown or hidden, hidden ones too. */
  const networkChoices = computed(() => facts.value?.networkChoices() ?? []);
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
    overlayRequestOf({
      overlay: mapOverlay.value,
      routeEnds: tools.routeEnds,
      routeOption: tools.routeOption,
      reachFrom: tools.reachFrom,
      coverageMetres: tools.coverageMetres,
    }),
  );
  const chrome = computed(() =>
    chromeOf({ phone: phone.value, mapOnly: mapOnly.value, sheet: sheet.value, timeMode: timeMode.value, minimap: player.value.minimap }),
  );
  const sheetHeight = computed(() => (phone.value ? sheetHeightOf(sheet.value, tabLabels.value) : null));
  const panelCover = computed(() => panelCoverOf({ phone: phone.value, mapOnly: mapOnly.value, panelOpen: panelOpen.value, panelWidth: panelWidth.value }));
  // None before the network is open.
  const mapProps = computed(() =>
    facts.value
      ? mapPropsOf({
          facts: facts.value,
          theme: theme.value,
          viewMode: viewMode.value,
          stationNames: stationNames.value,
          streetNames: streetNames.value,
          timeMode: timeMode.value,
          openStation: openStation.value,
          openLine: openLine.value,
          overlay: overlayRequest.value,
          boundary: tools.boundary,
          player: player.value,
          padding: mapPaddingFor(sheetHeight.value),
          panelCover: panelCover.value,
        })
      : null,
  );

  /**
   * Sets everything for a page opening: the network's facts, and what the address says; the rest as
   * a page opens. A station or line the network does not have is a stale link, left out.
   *
   * @param stored - The city's network, as stored.
   * @param shownPlan - The plan to show built on it, if any.
   * @param address - What the address asks for.
   * @param opening - The section to open on without one in the address: Plans for a plan, else Lines.
   * @returns The network's facts.
   */
  const open = (stored: Network, shownPlan: string | undefined, address: ExplorerUrlState, opening: Section): NetworkFacts => {
    const opened = markRaw(NetworkFacts.create(stored, shownPlan ? { plan: shownPlan } : {}));
    pickedPlan.value = shownPlan;
    network.value = markRaw(stored);
    facts.value = opened;
    const line = address.line && opened.find('line', address.line) ? address.line : undefined;
    const station = address.station && opened.find('station', address.station) ? address.station : undefined;
    section.value = address.section ?? opening;
    views.value = [...(line ? [{ kind: 'line' as const, id: line }] : []), ...(station ? [{ kind: 'station' as const, id: station }] : [])];
    timeMode.value = 'timeline';
    sheet.value = 'peek';
    mapOnly.value = address.mapOnly ?? false;
    panelOpen.value = address.panelOpen ?? true;
    player.value = {
      speed: address.speed ?? DEFAULT_PLAYER.speed,
      camera: address.camera ?? DEFAULT_PLAYER.camera,
      minimap: address.minimap ?? DEFAULT_PLAYER.minimap,
    };
    dialog.value = null;
    tools.open(opened, address);
    viewMode.value = address.viewMode ?? '2d';
    stationNames.value = address.stationNames ?? true;
    streetNames.value = address.streetNames ?? true;
    time.value = null;
    step.value = null;
    view.value = address.view ?? null;
    openingPlayhead = address.at;
    return opened;
  };

  /**
   * Shows the network made again, with a plan or none and some lines hidden, on the same page and
   * map, the map drawing it where it looks, at its today. What was open stays where the new network has it.
   *
   * @param shownPlan - The plan to show built on it; none for the network as built.
   * @param hidden - The lines to hide.
   */
  const remake = (shownPlan: string | undefined, hidden: readonly string[]) => {
    if (!network.value) return;
    const next = markRaw(NetworkFacts.create(network.value, { ...(shownPlan ? { plan: shownPlan } : {}), hidden }));
    facts.value = next;
    views.value = views.value.filter(view => next.find(view.kind, view.id));
    tools.keepOn(next);
    timeMode.value = 'timeline';
    step.value = null;
  };

  /**
   * Moves the map to a playhead of the network shown.
   *
   * @param where - Picks it from the network's playheads.
   */
  const seekTo = (where: (playheads: NetworkFacts['playheads']) => Playhead) => {
    if (facts.value) map.value?.seek(where(facts.value.playheads));
  };

  /**
   * Shows another plan, or the network as built, with the plan built (else today).
   *
   * @param shownPlan - The plan to show built on it; none for the network as built.
   */
  const showPlan = async (shownPlan: string | undefined) => {
    pickedPlan.value = shownPlan;
    remake(shownPlan, facts.value?.hidden ?? []);
    // Once the map has the new network (it opens at its today), on to the plan built.
    await nextTick();
    if (shownPlan) seekTo(playheads => playheads.end());
  };

  /**
   * Shows some lines, or hides them as if they were not there, on the day shown: every count, the
   * history and the coverage leave them out. The plan picked goes while a line it builds on is hidden,
   * and is back once it shows.
   *
   * @param lines - The lines' ids.
   * @param shown - Whether to show them.
   */
  const showLines = async (lines: readonly string[], shown: boolean) => {
    const day = time.value && !time.value.atRest ? time.value.time : undefined;
    const hidden = facts.value?.hidden ?? [];
    remake(pickedPlan.value, shown ? hidden.filter(id => !lines.includes(id)) : [...new Set([...hidden, ...lines])]);
    // The new network opens at its today: back to the day shown, if it was another.
    await nextTick();
    if (day !== undefined) seekTo(playheads => playheads.on(day));
  };

  /**
   * The map is mounted: it is shown where the address opened, or a plan built.
   *
   * @param mounted - The map.
   */
  const attach = (mounted: TransitMap) => {
    map.value = markRaw(mounted);
    credits.value = mounted.credits;
    const opening = openingPlayhead;
    if (opening) seekTo(playheads => playheadOf(opening, playheads));
    else if (plan.value) seekTo(playheads => playheads.end());
  };
  /** The map is taken down. */
  const detach = () => (map.value = null);

  /**
   * The map moved through time.
   *
   * @param next - The time it told.
   */
  const timeChanged = (next: TimeState) => {
    time.value = next;
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
  /**
   * A station clicked on the map: with Route or Reach in sight, picked as their ends; else it opens.
   *
   * @param id - The station, or `null` for a click away from any.
   */
  const clickStation = (id: string | null) => {
    if (!id || !facts.value || !time.value) return closeStation();
    const stop = { id, name: facts.value.asOf(time.value).station(id).name };
    const picking = views.value.length === 0 && (phone.value || panelOpen.value);
    const pick = stationPickOf({ section: section.value, picking, routeEnds: tools.routeEnds }, stop);
    if (pick.kind === 'route') tools.setRouteEnds(pick.ends);
    else if (pick.kind === 'reach') tools.setReachFrom(pick.from);
    else pickStation(id);
  };
  /** Back from a pushed view: to the station walked from, the line under it, else the section. */
  const goBack = () => (views.value = views.value.slice(0, -1));

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

  /**
   * Plays on from the date the timeline stands at, where it was dragged or paused (from the start
   * again once at its end); the panel stays on what is open in it (Changes, open, follows along).
   */
  const play = () => {
    timeMode.value = 'playing';
    map.value?.play();
  };
  /** Pauses where it is: the timeline, at the date reached. */
  const pause = () => {
    map.value?.pause();
    timeMode.value = 'timeline';
  };
  /** Plays or pauses. */
  const togglePlay = () => (timeMode.value === 'playing' && time.value?.playing ? pause() : play());
  /**
   * Leaves for one of the network's places: today, where the map rests (today, or a plan built) or the
   * end; playing, it stops, the whole network back in view.
   *
   * @param place - Where to, as `Playheads` names it.
   */
  const leaveTo = (place: 'today' | 'rest' | 'end') => {
    if (timeMode.value === 'playing') map.value?.stop();
    timeMode.value = 'timeline';
    seekTo(playheads => playheads[place]());
  };
  /** The change before the one shown; playing, it plays again. */
  const previousChange = () => map.value?.previousChange();
  /** Finishes the change playing, or goes to the next one. */
  const nextChange = () => map.value?.skip();
  /**
   * Shows what the timeline was picked at: playing, it plays on from there.
   *
   * @param target - A date, a change, or the plan built.
   */
  const pick = (target: TimelineTarget) => {
    if (target.kind === 'planBuilt') seekTo(playheads => playheads.end());
    else if (target.kind === 'change') seekTo(playheads => playheads.after(target.index + 1));
    else seekTo(playheads => playheads.on(target.time));
  };
  /**
   * A change picked in a list: while playing, playback goes back to play it; otherwise the map shows it.
   *
   * @param index - The change.
   */
  const pickChange = (index: number) => {
    if (timeMode.value === 'playing' && facts.value) map.value?.play(facts.value.playheads.before(index));
    else seekTo(playheads => playheads.after(index + 1));
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
   * A year picked on a chart: the map at its end (today, for this year), which the timeline shows.
   *
   * @param year - The year.
   */
  const showYear = (year: number) => {
    seekTo(playheads => playheads.on(Math.min(endOfYear(year), playheads.today().time)));
  };

  return {
    section,
    views,
    timeMode,
    phone,
    tabLabels,
    panelOpen,
    panelWidth,
    sheet,
    sheetHeight,
    mapOnly,
    dialog,
    viewMode,
    stationNames,
    streetNames,
    player,
    time,
    step,
    view,
    facts,
    networkChoices,
    plan,
    pickedPlan,
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
    showPlan,
    showLines,
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
    clickStation,
    goBack,
    setMapOnly,
    setDialog,
    dialogOpen,
    setPlayer,
    play,
    togglePlay,
    pause,
    leaveTo,
    previousChange,
    nextChange,
    pick,
    pickChange,
    stepTime,
    showYear,
  };
});
