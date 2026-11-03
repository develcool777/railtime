import type { NetworkFacts } from '@railtime/network/facts.service';
import type { CoverageDistance, Stop } from '@railtime/network/facts.types';
import { COVERAGE_DEFAULT_METRES } from '@railtime/network/coverage.constants';
import type { OverlayResult } from '@railtime/renderer/transitMap.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';

import type { ExplorerUrlState } from '~/features/explorer/address/address.types';
import type { RouteEnds } from '~/features/explorer/tools.types';
import { routeAimOf } from '~/features/explorer/tools.utils';

/**
 * The map's tools, and what changes them: a route's ends and the way between them drawn, a reach's
 * start, how far coverage counts and the city's outline it is measured in, and what the map found for
 * the one drawn. The explorer's store reads them for `mapProps`, and acts on a station clicked on the
 * map with them (`stationPickOf`); the address keeps them (`useExplorerAddress`).
 */
export const useToolsStore = defineStore('explorerTools', () => {
  const routeEnds = ref<RouteEnds>({ from: null, to: null });
  /** The way between the route's ends drawn, fastest first. */
  const routeOption = ref(0);
  /** The end of the route a station clicked on the map fills: shown on its field. */
  const routeAim = ref<keyof RouteEnds>('from');
  const reachFrom = ref<Stop | null>(null);
  const coverageMetres = ref<CoverageDistance>(COVERAGE_DEFAULT_METRES);
  /** The city's outline, coverage's, once fetched: written by the coverage part. */
  const boundary = shallowRef<CityBoundary | null>(null);
  /** What the map found for the overlay drawn: written by the map's listener. */
  const overlayResult = shallowRef<OverlayResult | null>(null);

  /**
   * Sets the tools as a page opens, from its address: a station the network does not have is a stale
   * link, left out.
   *
   * @param facts - The network opened.
   * @param address - What the address asks for.
   */
  const open = (facts: NetworkFacts, address: ExplorerUrlState) => {
    const stop = (id: string | undefined) => (id ? facts.find('station', id) : null);
    routeEnds.value = { from: stop(address.route?.from), to: stop(address.route?.to) };
    routeOption.value = address.route?.option ?? 0;
    routeAim.value = routeAimOf(routeEnds.value);
    reachFrom.value = stop(address.reach);
    coverageMetres.value = address.walk ?? COVERAGE_DEFAULT_METRES;
    boundary.value = null;
    overlayResult.value = null;
  };

  /**
   * Keeps the ends on another network made of the same city (a plan shown, lines hidden): those it has.
   *
   * @param facts - The network made again.
   */
  const keepOn = (facts: NetworkFacts) => {
    const keep = (stop: Stop | null) => (stop && facts.find('station', stop.id) ? stop : null);
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
  const setRouteEnds = (ends: RouteEnds) => {
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
  const setRouteEnd = (end: keyof RouteEnds, stop: Stop | null) => setRouteEnds({ ...routeEnds.value, [end]: stop });
  /**
   * Aims the map at one end of the route: the next station clicked on it is that end.
   *
   * @param end - Where it starts, or where it ends.
   */
  const aimRoute = (end: keyof RouteEnds) => (routeAim.value = end);
  /** Clears both ends of the route, to start again. */
  const clearRoute = () => setRouteEnds({ from: null, to: null });
  /** Swaps where the route starts and ends. */
  const swapEnds = () => setRouteEnds({ from: routeEnds.value.to, to: routeEnds.value.from });
  /**
   * Draws another way between the route's ends.
   *
   * @param option - Its place among them, fastest first.
   */
  const chooseRoute = (option: number) => (routeOption.value = option);
  /**
   * Sets where the reach starts, or clears it.
   *
   * @param stop - The station, or `null`.
   */
  const setReachFrom = (stop: Stop | null) => (reachFrom.value = stop);
  /**
   * Coverage measured within another distance of a station: the panel's figures and the map's shading.
   *
   * @param metres - The distance.
   */
  const showCoverageWithin = (metres: CoverageDistance) => (coverageMetres.value = metres);

  return {
    routeEnds,
    routeOption,
    routeAim,
    reachFrom,
    coverageMetres,
    boundary,
    overlayResult,
    open,
    keepOn,
    setRouteEnds,
    setRouteEnd,
    aimRoute,
    clearRoute,
    swapEnds,
    chooseRoute,
    setReachFrom,
    showCoverageWithin,
  };
});
