import type { LngLat } from '@railtime/schema/network.types';
import type { FeatureCollection, LineFeature, PointFeature } from './features.types';

/**
 * A collection with no features.
 *
 * @returns An empty feature collection.
 */
export const emptyCollection = <Item>(): FeatureCollection<Item> => ({ type: 'FeatureCollection', features: [] });

/**
 * A line feature.
 *
 * @param coordinates - Its points, in the direction it is drawn.
 * @param color - Its colour.
 * @param offset - Its side-by-side slot, relative to the direction of `coordinates`.
 * @param highlight - 0 normally, up to 1 for new track.
 * @param line - The line it is drawn for; none for a transfer's link.
 * @returns The feature.
 */
export const lineFeature = (coordinates: LngLat[], color: string, offset: number, highlight = 0, line = ''): LineFeature => ({
  type: 'Feature',
  properties: { color, offset, highlight, line },
  geometry: { type: 'LineString', coordinates },
});

/**
 * A point feature.
 *
 * @param coordinates - Where it is.
 * @param properties - Its properties.
 * @returns The feature.
 */
export const pointFeature = <Properties>(coordinates: LngLat, properties: Properties): PointFeature<Properties> => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates },
});
