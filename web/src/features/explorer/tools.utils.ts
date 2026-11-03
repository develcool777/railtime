import type { CoverageDistance, Stop } from '@railtime/network/facts.types';
import type { OverlayRequest } from '@railtime/renderer/transitMap.types';

import type { Section, TimeMode } from '~/features/explorer/explorer.types';
import type { MapOverlay, RouteEnds, StationPick } from '~/features/explorer/tools.types';

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

/** What a station clicked on the map is picked for is worked out from. */
type PickInput = {
  section: Section;
  /** The panel is in sight with nothing pushed over its section. */
  picking: boolean;
  routeEnds: RouteEnds;
};

/**
 * What a station clicked on the map does: with Route in sight it is the route's next end (where it
 * starts, then where it ends, then where it ends again); with Reach in sight, where the reach starts;
 * else, or over a station or line already open, it opens.
 *
 * @param input - The section open, whether the panel is in sight with nothing pushed over it, and the route's ends.
 * @param stop - The station clicked.
 * @returns What it does.
 */
export const stationPickOf = (input: PickInput, stop: Stop): StationPick => {
  const { section, picking, routeEnds } = input;
  if (!picking || (section !== 'route' && section !== 'reach')) return { kind: 'open' };
  if (section === 'reach') return { kind: 'reach', from: stop };
  if (!routeEnds.from) return { kind: 'route', ends: { ...routeEnds, from: stop } };
  // The start again ends nothing.
  if (routeEnds.from.id === stop.id) return { kind: 'route', ends: routeEnds };
  return { kind: 'route', ends: { ...routeEnds, to: stop } };
};
