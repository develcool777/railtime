import type { StillRequest, StillTrack } from '@railtime/renderer/basemapStill.types';
import type { MapView } from '@railtime/renderer/transitMap.types';
import type { Network } from '@railtime/schema/network.types';
import type { LngLat } from '@railtime/core/geometry.types';
import { pushTo } from '@railtime/core/collection.utils';
import { latitudeOf, mercatorY } from '@railtime/core/geometry.utils';
import { buildPlan, firstPlanOf, isPlanOnly } from '@railtime/schema/plan.utils';
import { MAX_PREVIEW_ZOOM, PREVIEW_PADDING, TILE_SIZE } from './preview.constants.ts';
import type { PreviewSize, PreviewTheme } from './preview.types.ts';

/**
 * Where a point lies on the Web Mercator world at zoom 0, as a fraction of its width and height.
 *
 * @param point - A coordinate.
 * @returns Its x and y, 0..1 from the top left.
 */
const mercator = (point: LngLat): [number, number] => [(point[0] + 180) / 360, 0.5 - mercatorY(point[1]) / (2 * Math.PI)];

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
  // The middle's y, back from the 0..1 fraction `mercator` gives to Web Mercator's own.
  const latitude = latitudeOf(Math.PI * (1 - (top + bottom)));
  return { center: [((left + right) / 2) * 360 - 180, latitude], zoom };
};

/**
 * The track a preview shows, each segment with its lines: what is open today, or for a network
 * never built, its first plan's.
 *
 * @param network - The city's network.
 * @returns Each segment's coordinates and line ids.
 */
const shownTrack = (network: Network): { coordinates: LngLat[]; lines: string[] }[] => {
  const openToday = network.segments.filter(segment => Object.values(segment.lines).some(dates => !dates.close));
  if (openToday.length > 0 || !network.plans) return openToday.map(segment => ({ coordinates: segment.coordinates, lines: Object.keys(segment.lines) }));
  const built = buildPlan(network, firstPlanOf(network) ?? '');
  return built.sections.flatMap(section =>
    // Within bounds: a built section's segments are the built network's.
    section.segments.map(position => ({ coordinates: built.network.segments[position]!.coordinates, lines: [section.line] })),
  );
};

/**
 * What a preview draws of a network: each line's track in the theme's colour (a segment shared by
 * several, its first line's), the network's first line on top, dashed for a network never built.
 *
 * @param network - The city's network.
 * @param theme - The preview's theme.
 * @returns The track by line, bottom first.
 */
export const previewTrackOf = (network: Network, theme: PreviewTheme): StillTrack[] => {
  const lines = { ...network.lines, ...network.plans?.[firstPlanOf(network) ?? '']?.lines };
  const lineOrder = Object.keys(lines);
  const dashed = isPlanOnly(network);
  const byLine = new Map<string, LngLat[][]>();
  for (const segment of shownTrack(network)) {
    const first = [...segment.lines].sort((one, other) => lineOrder.indexOf(one) - lineOrder.indexOf(other))[0] ?? '';
    pushTo(byLine, first, segment.coordinates);
  }
  return [...byLine]
    .sort(([one], [other]) => lineOrder.indexOf(other) - lineOrder.indexOf(one))
    .map(([id, paths]) => {
      const line = lines[id];
      const color = (theme === 'dark' ? line?.darkColor : undefined) ?? line?.color ?? '#888888';
      return { color, paths, dashed };
    });
};

/**
 * The picture to take of a network: its track, framed to fill the preview.
 *
 * @param network - The city's network.
 * @param theme - The preview's theme.
 * @param size - The preview's size, in CSS pixels.
 * @returns The request, or `null` for a network with no track to show.
 */
export const previewRequestOf = (network: Network, theme: PreviewTheme, size: PreviewSize): StillRequest | null => {
  const track = previewTrackOf(network, theme);
  const points = track.flatMap(line => line.paths.flat());
  if (points.length === 0) return null;
  return { view: fitView(points, size), ...size, track };
};

/**
 * Where a city's preview is kept: beside its network, one file per theme.
 *
 * @param networkPath - The path of `cities/<country>/<city>/<city>.json`.
 * @param theme - The preview's theme.
 * @returns The path of `<city>.<theme>.webp` beside it.
 */
export const previewPathOf = (networkPath: string, theme: PreviewTheme): string => networkPath.replace(/\.json$/, `.${theme}.webp`);

/**
 * Where a city's social card is kept: the picture a link to its page shows, beside its network. JPEG,
 * which every link preview reads.
 *
 * @param networkPath - The path of `cities/<country>/<city>/<city>.json`.
 * @returns The path of `<city>.social.jpg` beside it.
 */
export const socialPathOf = (networkPath: string): string => networkPath.replace(/\.json$/, '.social.jpg');
