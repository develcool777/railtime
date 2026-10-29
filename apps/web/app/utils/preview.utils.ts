import type { LngLat, Network } from '@railtime/schema/network.types';
import type { PreviewPath } from './city.types';

/** A sketch's width in SVG units: the card scales it. */
export const PREVIEW_WIDTH = 320;
/** A sketch's height in SVG units: 16:9, like the card's placeholder. */
export const PREVIEW_HEIGHT = 180;
const PREVIEW_PADDING = 10;
const RADIANS_PER_DEGREE = Math.PI / 180;

/**
 * A network drawn small, for a city card: every segment as a path in its first line's colour, fitted
 * into the sketch with longitude shrunk for the city's latitude, so the shape matches the map.
 *
 * @param network - The city's network.
 * @returns One path per segment that is open today, in the network's line order.
 */
export const previewPathsOf = (network: Network): PreviewPath[] => {
  const lineOrder = Object.keys(network.lines);
  const openToday = network.segments.filter(segment => Object.values(segment.lines).some(dates => !dates.close));
  const points = openToday.flatMap(segment => segment.coordinates);
  if (points.length === 0) return [];
  const longitudes = points.map(point => point[0]);
  const latitudes = points.map(point => point[1]);
  const [west, east, south, north] = [Math.min(...longitudes), Math.max(...longitudes), Math.min(...latitudes), Math.max(...latitudes)];
  const longitudeScale = Math.cos(((south + north) / 2) * RADIANS_PER_DEGREE);
  const spanX = Math.max((east - west) * longitudeScale, 1e-9);
  const spanY = Math.max(north - south, 1e-9);
  const scale = Math.min((PREVIEW_WIDTH - 2 * PREVIEW_PADDING) / spanX, (PREVIEW_HEIGHT - 2 * PREVIEW_PADDING) / spanY);
  const offsetX = (PREVIEW_WIDTH - spanX * scale) / 2;
  const offsetY = (PREVIEW_HEIGHT - spanY * scale) / 2;
  const project = (point: LngLat) =>
    `${(offsetX + (point[0] - west) * longitudeScale * scale).toFixed(1)},${(offsetY + (north - point[1]) * scale).toFixed(1)}`;
  return openToday
    .map(segment => {
      const lines = Object.keys(segment.lines).sort((first, second) => lineOrder.indexOf(first) - lineOrder.indexOf(second));
      const line = network.lines[lines[0] ?? ''];
      return {
        order: lineOrder.indexOf(lines[0] ?? ''),
        path: `M${segment.coordinates.map(project).join('L')}`,
        color: line?.color ?? 'currentColor',
        darkColor: line?.darkColor ?? line?.color ?? 'currentColor',
      };
    })
    .sort((first, second) => second.order - first.order)
    .map(({ path, color, darkColor }) => ({ path, color, darkColor }));
};
