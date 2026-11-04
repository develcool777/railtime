import type { CoverageDistance, CoverageInfo, ReachInfo, Stop } from '@railtime/network/facts.types';
import type { OverlayRequest, OverlayResult } from '@railtime/renderer/transitMap.types';

import type { Section, TimeMode } from '~/features/explorer/explorer.types';
import type { FoundRoutes, MapOverlay, RouteEnds, StationPick } from '~/features/explorer/tools.types';

/**
 * What the map draws over the network for the section open. Playback hides a route and a reach, which
 * would cover the line growing and fade the network it is drawn over; coverage, which grows with the
 * network, stays.
 *
 * @param section - The section open.
 * @param timeMode - What the time control shows.
 * @returns The overlay, or `null` for none.
 */
export const mapOverlayOf = (section: Section, timeMode: TimeMode): MapOverlay | null => {
  if (section === 'coverage') return 'coverage';
  if (timeMode === 'playing') return null;
  return section === 'route' || section === 'reach' ? section : null;
};

/** What the map's overlay is worked out from: which one, and what each is of. */
type OverlayInput = {
  overlay: MapOverlay | null;
  routeEnds: RouteEnds;
  /** The way between the route's ends drawn, fastest first. */
  routeOption: number;
  reachFrom: Stop | null;
  coverageMetres: CoverageDistance;
};

/**
 * What to ask the map to draw over the network: the overlay of the section open, once it has what it
 * needs (a route both its ends, a reach its start).
 *
 * @param input - The overlay, the route's ends and the way drawn, the reach's start, coverage's distance.
 * @returns The request, or `null` for nothing to draw.
 */
export const overlayRequestOf = (input: OverlayInput): OverlayRequest | null => {
  const { overlay, routeEnds, routeOption, reachFrom, coverageMetres } = input;
  if (overlay === 'coverage') return { kind: 'coverage', metres: coverageMetres };
  if (overlay === 'route' && routeEnds.from && routeEnds.to) return { kind: 'route', from: routeEnds.from.id, to: routeEnds.to.id, option: routeOption };
  if (overlay === 'reach' && reachFrom) return { kind: 'reach', from: reachFrom.id };
  return null;
};

/**
 * The end of a route a station clicked on the map fills next: where it starts, until it has one;
 * then where it ends, again and again.
 *
 * @param ends - The route's ends.
 * @returns The end.
 */
export const routeAimOf = (ends: RouteEnds): keyof RouteEnds => (ends.from ? 'to' : 'from');

/** What a station clicked on the map is picked for is worked out from. */
type PickInput = {
  section: Section;
  /** The panel is in sight with nothing pushed over its section. */
  picking: boolean;
  routeEnds: RouteEnds;
  /** The end of the route it fills. */
  routeAim: keyof RouteEnds;
};

/**
 * What a station clicked on the map does: with Route in sight it is the end of the route aimed at
 * (`routeAimOf`, or the one chosen); with Reach in sight, where the reach starts; else, or over a
 * station or line already open, it opens.
 *
 * @param input - The section open, whether the panel is in sight with nothing pushed over it, the route's ends and the one aimed at.
 * @param stop - The station clicked.
 * @returns What it does.
 */
export const stationPickOf = (input: PickInput, stop: Stop): StationPick => {
  const { section, picking, routeEnds, routeAim } = input;
  if (!picking || (section !== 'route' && section !== 'reach')) return { kind: 'open' };
  if (section === 'reach') return { kind: 'reach', from: stop };
  // The route's other end again leaves it as it is: a route from a station to itself is none.
  const other = routeEnds[routeAim === 'from' ? 'to' : 'from'];
  if (other?.id === stop.id) return { kind: 'route', ends: routeEnds };
  return { kind: 'route', ends: { ...routeEnds, [routeAim]: stop } };
};

/**
 * What a station clicked on the map does, said under the field it fills.
 *
 * @param end - The end it fills: a route's or a reach's start, or a route's end.
 * @param picked - It is picked already.
 * @returns The hint.
 */
export const mapPickHint = (end: 'start' | 'end', picked: boolean): string =>
  picked ? `Click the map to change the ${end}.` : `Click the map for the ${end}.`;

/**
 * The ways between a route's ends the map found, if the overlay it drew was a route.
 *
 * @param result - What the map found for the overlay drawn, if anything.
 * @returns The ways and the one drawn, or `null` for another overlay or none.
 */
export const foundRoutesOf = (result: OverlayResult | null): FoundRoutes | null =>
  result?.kind === 'route' ? { routes: result.routes, shown: result.shown } : null;

/**
 * How far one gets from a station, if the overlay the map drew was a reach.
 *
 * @param result - What the map found for the overlay drawn, if anything.
 * @returns The reach, or `null` for another overlay, none, or no line calling there.
 */
export const foundReachOf = (result: OverlayResult | null): ReachInfo | null => (result?.kind === 'reach' ? result.reach : null);

/**
 * How much of the city is within the distance of a station, if the overlay the map drew was coverage.
 *
 * @param result - What the map found for the overlay drawn, if anything.
 * @returns The coverage, or `null` for another overlay, none, or none on the date.
 */
export const foundCoverageOf = (result: OverlayResult | null): CoverageInfo | null => (result?.kind === 'coverage' ? result.coverage : null);
