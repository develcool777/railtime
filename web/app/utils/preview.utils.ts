import type { IndexedTrack } from '@railtime/schema/cityIndex.types';
import type { LngLat } from '@railtime/schema/network.types';
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
 * A network drawn small, for a city card: the view that fits its track, and each line's track as a
 * path, projected as the basemap is, so the picture of the basemap lies under it.
 *
 * @param track - The city's track, by line, in drawing order, as the index keeps it.
 * @param size - The preview's size, in CSS pixels.
 * @returns The view, and one path per line; no view without track.
 */
export const previewOf = (track: IndexedTrack[], size: PreviewSize): Preview | null => {
  const points = track.flatMap(line => line.paths.flat());
  if (points.length === 0) return null;
  const view = fitView(points, size);
  const project = (point: LngLat) =>
    projectPoint(view, size, point)
      .map(value => value.toFixed(1))
      .join(',');
  return {
    view,
    paths: track.map(line => ({ path: line.paths.map(path => `M${path.map(project).join('L')}`).join(''), color: line.color, darkColor: line.darkColor })),
  };
};
