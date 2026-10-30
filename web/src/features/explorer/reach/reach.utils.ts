import type { ReachInfo } from '@railtime/renderer/transitMap.types';

import type { ReachGroup } from '~/features/explorer/reach/reach.types';

/**
 * A reach's stations by band, every band kept, an empty one too, so the legend reads the same for
 * any start.
 *
 * @param reach - The reach.
 * @returns Its bands, soonest first, each with its stations.
 */
export const reachGroups = (reach: ReachInfo): ReachGroup[] =>
  reach.bands.map((band, position) => ({ band, position, stations: reach.stations.filter(station => station.band === position) }));

/**
 * A time in minutes, read as a person would say it.
 *
 * @param minutes - The time.
 * @returns "45 min", "1 h", "1 h 52 min".
 */
export const formatMinutes = (minutes: number): string => {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const rest = rounded % 60;
  return rest === 0 ? `${rounded / 60} h` : `${Math.floor(rounded / 60)} h ${rest} min`;
};
