import type { LngLat, Network } from '@railtime/schema/network.types';
import { buildPlan } from '@railtime/schema/plan.utils';
import type { MapView } from '@railtime/renderer/transitMap.types';
import type { Preview, PreviewSize } from './city.types';

/** Room kept around the track in a preview, in CSS pixels. */
const PREVIEW_PADDING = 16;
/** The basemap's tile size: a world `TILE_SIZE · 2^zoom` pixels wide, as MapLibre lays it out. */
const TILE_SIZE = 512;
/** The deepest a preview zooms, for a network of one short line. */
const MAX_PREVIEW_ZOOM = 15;
const RADIANS_PER_DEGREE = Math.PI / 180;

/**
 * Where a point lies on the Web Mercator world at zoom 0, as a fraction of its width and height.
 *
 * @param point - A coordinate.
 * @returns Its x and y, 0..1 from the top left.
 */
const mercator = (point: LngLat): [number, number] => {
  const sine = Math.sin(point[1] * RADIANS_PER_DEGREE);
  return [(point[0] + 180) / 360, 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)];
};

/**
 * The view that fits points into a picture, as the map would frame them.
 *
 * @param points - The points to fit; at least one.
 * @param size - The picture's size, in CSS pixels.
 * @returns The centre and zoom.
 */
export const fitView = (points: LngLat[], size: PreviewSize): MapView => {
  const projected = points.map(mercator);
  const across = projected.map(point => point[0]);
  const down = projected.map(point => point[1]);
  const [left, right, top, bottom] = [Math.min(...across), Math.max(...across), Math.min(...down), Math.max(...down)];
  const room = (length: number) => Math.max(1, length - 2 * PREVIEW_PADDING);
  const scale = Math.min(room(size.width) / Math.max(right - left, 1e-12), room(size.height) / Math.max(bottom - top, 1e-12));
  const zoom = Math.min(MAX_PREVIEW_ZOOM, Math.log2(scale / TILE_SIZE));
  const middleX = (left + right) / 2;
  const middleY = (top + bottom) / 2;
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - 2 * middleY))) * 180) / Math.PI;
  return { center: [middleX * 360 - 180, latitude], zoom };
};

/**
 * Where a coordinate lands in a picture of a view.
 *
 * @param view - Where the picture looks.
 * @param size - The picture's size, in CSS pixels.
 * @param point - A coordinate.
 * @returns Its x and y in the picture.
 */
export const projectPoint = (view: MapView, size: PreviewSize, point: LngLat): [number, number] => {
  const world = TILE_SIZE * 2 ** view.zoom;
  const [x, y] = mercator(point);
  const [centreX, centreY] = mercator(view.center);
  return [(x - centreX) * world + size.width / 2, (y - centreY) * world + size.height / 2];
};

/**
 * The track a city card draws, each with its lines: what is open today, or for a network never built,
 * its first plan's.
 *
 * @param network - The city's network.
 * @returns Each segment's coordinates and line ids.
 */
const shownTrack = (network: Network): { coordinates: LngLat[]; lines: string[] }[] => {
  const openToday = network.segments.filter(segment => Object.values(segment.lines).some(dates => !dates.close));
  if (openToday.length > 0 || !network.plans) return openToday.map(segment => ({ coordinates: segment.coordinates, lines: Object.keys(segment.lines) }));
  const built = buildPlan(network, Object.keys(network.plans)[0] ?? '');
  return built.sections.flatMap(section =>
    // Within bounds: a built section's segments are the built network's.
    section.segments.map(position => ({ coordinates: built.network.segments[position]!.coordinates, lines: [section.line] })),
  );
};

/**
 * A network drawn small, for a city card: the view that fits it, and every segment as a path in its
 * first line's colour, projected as the basemap is, so the picture of the basemap lies under it.
 *
 * @param network - The city's network.
 * @param size - The preview's size, in CSS pixels.
 * @returns The view, and one path per segment open today (or planned, for a network never built), in the network's line order; no view without track.
 */
export const previewOf = (network: Network, size: PreviewSize): Preview | null => {
  const lines = { ...network.lines, ...Object.values(network.plans ?? {})[0]?.lines };
  const lineOrder = Object.keys(lines);
  const openToday = shownTrack(network);
  const points = openToday.flatMap(segment => segment.coordinates);
  if (points.length === 0) return null;
  const view = fitView(points, size);
  const project = (point: LngLat) =>
    projectPoint(view, size, point)
      .map(value => value.toFixed(1))
      .join(',');
  const paths = openToday
    .map(segment => {
      const ordered = [...segment.lines].sort((first, second) => lineOrder.indexOf(first) - lineOrder.indexOf(second));
      const line = lines[ordered[0] ?? ''];
      return {
        order: lineOrder.indexOf(ordered[0] ?? ''),
        path: `M${segment.coordinates.map(project).join('L')}`,
        color: line?.color ?? 'currentColor',
        darkColor: line?.darkColor ?? line?.color ?? 'currentColor',
      };
    })
    .sort((first, second) => second.order - first.order)
    .map(({ path, color, darkColor }) => ({ path, color, darkColor }));
  return { view, paths };
};
