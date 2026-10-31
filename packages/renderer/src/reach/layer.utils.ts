import type { NetworkEngine } from '@railtime/network/engine.service';
import { required } from '@railtime/core/required.utils';
import type { ReachInfo } from '@railtime/network/facts.types';
import type { PointFeature, ReachStopProperties, ReachTrackFeature } from '../layers/features.types';
import { pointFeature } from '../layers/features.utils';

/**
 * A band's colour.
 *
 * @param reach - The reach.
 * @param band - The band's place in its bands.
 * @returns Its colour.
 */
const bandColor = (reach: ReachInfo, band: number): string => required(reach.bands[band], `reach band ${band}`).color;

/**
 * The track a reach colours, each segment in its band's colour.
 *
 * @param index - The network.
 * @param reach - The reach, or `null`.
 * @returns The track; none without a reach.
 */
export const reachTrack = (index: NetworkEngine['index'], reach: ReachInfo | null): ReachTrackFeature[] => {
  if (!reach) return [];
  return reach.track.map(({ segment, band }) => ({
    type: 'Feature',
    properties: { color: bandColor(reach, band) },
    geometry: { type: 'LineString', coordinates: required(index.segments[segment], `segment ${segment}`).coordinates },
  }));
};

/**
 * The stations a reach gets to, each in its band's colour and named with its time, the start first.
 *
 * @param index - The network.
 * @param reach - The reach, or `null`.
 * @returns The stations; none without a reach.
 */
export const reachStops = (index: NetworkEngine['index'], reach: ReachInfo | null): PointFeature<ReachStopProperties>[] =>
  reach
    ? [
        pointFeature(index.coordOf(reach.from.id), { color: bandColor(reach, 0), label: reach.from.name, minutes: 0, origin: true }),
        ...reach.stations.map(station =>
          pointFeature(index.coordOf(station.id), {
            color: bandColor(reach, station.band),
            label: `${station.name} · ${Math.round(station.minutes)} min`,
            minutes: station.minutes,
            origin: false,
          }),
        ),
      ]
    : [];
