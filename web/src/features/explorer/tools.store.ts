import { COVERAGE_DEFAULT_METRES } from '@railtime/network/coverage.constants';
import type { CoverageDistance, Stop } from '@railtime/network/facts.types';
import type { OverlayResult } from '@railtime/renderer/transitMap.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { defineStore } from 'pinia';
import { computed, markRaw, ref, shallowRef } from 'vue';
import { STORE_IDS } from '~/constants/store.constants';
import type { ExplorerUrlState } from '~/features/explorer/address/address.types';
import { useNetworkStore } from '~/features/explorer/network.store';
import type { BoundaryState, RouteEnds } from '~/features/explorer/tools.types';
import { foundReachOf, foundRoutesOf, routeAimOf } from '~/features/explorer/tools.utils';
import { fetchBoundary } from '~/utils/city.utils';
import { foundCoverageOf } from '~/utils/overlay.utils';

/**
 * The map's tools, and what changes them: a route's ends and the way between them drawn, a reach's
 * start, how far coverage counts and the city's outline it is measured in (fetched the first time it
 * is wanted, and where that stands), and what the map found for the one drawn. It reads the network
 * shown; the explorer's store reads it for `mapProps`, acts on a station clicked on the map with it
 * (`stationPickOf`), and writes it in the address.
 */
export const useToolsStore = defineStore(STORE_IDS.EXPLORER_TOOLS, () => {
  const network = useNetworkStore();

  // ---- State
  const routeEnds = ref<RouteEnds>({ from: null, to: null });
  /** The way between the route's ends drawn, fastest first. */
  const routeOption = ref(0);
  /** The end of the route a station clicked on the map fills: shown on its field. */
  const routeAim = ref<keyof RouteEnds>('from');
  const reachFrom = ref<Stop | null>(null);
  const coverageMetres = ref<CoverageDistance>(COVERAGE_DEFAULT_METRES);
  /** The city's outline, coverage's, once fetched. */
  const boundary = shallowRef<CityBoundary | null>(null);
  /** Where the outline is: not asked for yet, coming, here, or there is none. */
  const boundaryState = ref<BoundaryState>('idle');
  /** Where the outline coming is served: an answer from anywhere else, asked before the city changed, is dropped. */
  const boundaryAsked = ref<string | null>(null);
  /** What the map found for the overlay drawn, as it tells it. */
  const overlayResult = shallowRef<OverlayResult | null>(null);

  // ---- Getters
  /** The ways between the route's ends on the date shown, and the one drawn; `null` while none is drawn. */
  const foundRoutes = computed(() => foundRoutesOf(overlayResult.value));
  /** Every station reached from the reach's start on the date shown; `null` while none is drawn. */
  const foundReach = computed(() => foundReachOf(overlayResult.value));
  /** How much of the city is within the distance on the date shown; `null` while it is not drawn. */
  const coverage = computed(() => foundCoverageOf(overlayResult.value));
  /** How coverage grew, year by year, within the distance; none before the outline is here. */
  const coverageHistory = computed(() => (boundary.value && network.facts ? network.facts.coverage(boundary.value).history(coverageMetres.value) : []));

  // ---- Actions
  /**
   * A station of the network shown, by its id: one it does not have is a stale link.
   *
   * @param id - The station's id, if one is given.
   * @returns The station, or `null`.
   */
  const stopOf = (id: string | undefined) => (id && network.facts ? network.facts.findStation(id) : null);
  /**
   * A station kept on a network made again: `null` if it has it no more.
   *
   * @param kept - The station, or `null`.
   * @returns It, or `null`.
   */
  const keep = (kept: Stop | null) => (kept && network.facts?.findStation(kept.id) ? kept : null);

  /**
   * Sets the tools as a page opens, from its address: a station the network does not have is a stale
   * link, left out.
   *
   * @param address - What the address asks for.
   */
  const OPEN = (address: ExplorerUrlState) => {
    routeEnds.value = { from: stopOf(address.route?.from), to: stopOf(address.route?.to) };
    routeOption.value = address.route?.option ?? 0;
    routeAim.value = routeAimOf(routeEnds.value);
    reachFrom.value = stopOf(address.reach);
    coverageMetres.value = address.walk ?? COVERAGE_DEFAULT_METRES;
    boundary.value = null;
    boundaryState.value = 'idle';
    boundaryAsked.value = null;
    overlayResult.value = null;
  };

  /**
   * Keeps the ends on the network made again of the same city (a plan shown, lines hidden): those it has.
   */
  const KEEP_ON = () => {
    routeEnds.value = { from: keep(routeEnds.value.from), to: keep(routeEnds.value.to) };
    routeAim.value = routeAimOf(routeEnds.value);
    reachFrom.value = keep(reachFrom.value);
  };

  /**
   * Sets where the route starts and ends: other ends, the fastest way between them again, and the
   * map aimed at the next end to fill.
   *
   * @param ends - The ends.
   */
  const SET_ROUTE_ENDS = (ends: RouteEnds) => {
    routeEnds.value = ends;
    routeOption.value = 0;
    routeAim.value = routeAimOf(ends);
  };
  /**
   * Sets one end of the route, or clears it.
   *
   * @param end - Where it starts, or where it ends.
   * @param stop - The station, or `null`.
   */
  const SET_ROUTE_END = (end: keyof RouteEnds, stop: Stop | null) => {
    SET_ROUTE_ENDS({ ...routeEnds.value, [end]: stop });
  };
  /**
   * Aims the map at one end of the route: the next station clicked on it is that end.
   *
   * @param end - Where it starts, or where it ends.
   */
  const AIM_ROUTE = (end: keyof RouteEnds) => {
    routeAim.value = end;
  };
  /** Clears both ends of the route, to start again. */
  const CLEAR_ROUTE = () => {
    SET_ROUTE_ENDS({ from: null, to: null });
  };
  /** Swaps where the route starts and ends. */
  const SWAP_ENDS = () => {
    SET_ROUTE_ENDS({ from: routeEnds.value.to, to: routeEnds.value.from });
  };
  /**
   * Draws another way between the route's ends.
   *
   * @param option - Its place among them, fastest first.
   */
  const CHOOSE_ROUTE = (option: number) => {
    routeOption.value = option;
  };
  /**
   * Sets where the reach starts, or clears it.
   *
   * @param stop - The station, or `null`.
   */
  const SET_REACH_FROM = (stop: Stop | null) => {
    reachFrom.value = stop;
  };
  /**
   * Coverage measured within another distance of a station: the panel's figures and the map's shading.
   *
   * @param metres - The distance.
   */
  const SHOW_COVERAGE_WITHIN = (metres: CoverageDistance) => {
    coverageMetres.value = metres;
  };

  /**
   * Fetches the city's outline the first time it is wanted; a city without one is said to have none.
   * One that comes once another city is open is dropped: that city fetches its own.
   *
   * @param url - Where it is served.
   */
  const LOAD_BOUNDARY = async (url: string) => {
    if (boundaryState.value !== 'idle') return;
    boundaryState.value = 'loading';
    boundaryAsked.value = url;
    const outline = await fetchBoundary(url);
    if (boundaryAsked.value !== url) return;
    boundary.value = outline && markRaw(outline);
    boundaryState.value = outline ? 'ready' : 'missing';
  };
  /**
   * What the map found for the overlay drawn, as it tells it.
   *
   * @param result - What it found, or `null` once the overlay is cleared.
   */
  const SET_OVERLAY_RESULT = (result: OverlayResult | null) => {
    overlayResult.value = result;
  };

  return {
    // State
    routeEnds,
    routeOption,
    routeAim,
    reachFrom,
    coverageMetres,
    boundary,
    boundaryState,
    boundaryAsked,
    overlayResult,
    // Getters
    foundRoutes,
    foundReach,
    coverage,
    coverageHistory,
    // Actions
    OPEN,
    KEEP_ON,
    SET_ROUTE_ENDS,
    SET_ROUTE_END,
    AIM_ROUTE,
    CLEAR_ROUTE,
    SWAP_ENDS,
    CHOOSE_ROUTE,
    SET_REACH_FROM,
    SHOW_COVERAGE_WITHIN,
    LOAD_BOUNDARY,
    SET_OVERLAY_RESULT,
  };
});
