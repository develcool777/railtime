import type { CityIndex, CityIndexEntry, IndexedTrack } from '@railtime/schema/cityIndex.types';
import type { LngLat, Network } from '@railtime/schema/network.types';
import { buildPlan, isPlanOnly } from '@railtime/schema/plan.utils';

/**
 * How much simpler the index's track is than the dataset's: a point is dropped while the line stays
 * within this share of the network's width or height, whichever is larger. A city's picture is a few
 * hundred pixels across, so a thousandth is under a pixel.
 */
const SIMPLIFY_SHARE = 1e-3;
/** Decimals kept of a coordinate in the index: about a metre. */
const COORDINATE_DECIMALS = 5;

/**
 * How far a point lies from the straight line between two others, in degrees as drawn.
 *
 * @param point - The point.
 * @param start - One end of the line.
 * @param end - The other.
 * @returns The distance.
 */
const offLine = (point: LngLat, start: LngLat, end: LngLat): number => {
  const [across, down] = [end[0] - start[0], end[1] - start[1]];
  const length = Math.hypot(across, down);
  if (length === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  return Math.abs(down * point[0] - across * point[1] + end[0] * start[1] - end[1] * start[0]) / length;
};

/**
 * A line with the points it can do without dropped (Douglas–Peucker): it keeps its ends, and every
 * point further than the tolerance from the line between those kept around it.
 *
 * @param points - The line.
 * @param tolerance - How far, in degrees, the simpler line may stray.
 * @returns The points kept, in order.
 */
const simplify = (points: LngLat[], tolerance: number): LngLat[] => {
  if (points.length < 3) return points;
  const kept = new Set([0, points.length - 1]);
  const spans: [number, number][] = [[0, points.length - 1]];
  while (spans.length > 0) {
    const [first, last] = spans.pop() ?? [0, 0];
    let furthest = -1;
    let distance = tolerance;
    for (let index = first + 1; index < last; index++) {
      // Within bounds: `first` and `last` are positions in `points`.
      const away = offLine(points[index]!, points[first]!, points[last]!);
      if (away > distance) [furthest, distance] = [index, away];
    }
    if (furthest < 0) continue;
    kept.add(furthest);
    spans.push([first, furthest], [furthest, last]);
  }
  return points.filter((_, index) => kept.has(index));
};

/**
 * The track a city's picture shows, each with its lines: what is open today, or for a network never
 * built, its first plan's.
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
 * The track a city's picture draws: each line's segments (a segment shared by several, its first
 * line's), simplified, the network's first line drawn last, on top.
 *
 * @param network - The city's network.
 * @returns The track by line, in drawing order.
 */
const indexedTrack = (network: Network): IndexedTrack[] => {
  const lines = { ...network.lines, ...Object.values(network.plans ?? {})[0]?.lines };
  const lineOrder = Object.keys(lines);
  const shown = shownTrack(network);
  const points = shown.flatMap(segment => segment.coordinates);
  const span = (axis: 0 | 1) => Math.max(...points.map(point => point[axis])) - Math.min(...points.map(point => point[axis]));
  const tolerance = points.length > 0 ? Math.max(span(0), span(1)) * SIMPLIFY_SHARE : 0;
  const round = (value: number) => Number(value.toFixed(COORDINATE_DECIMALS));
  const byLine = new Map<string, LngLat[][]>();
  for (const segment of shown) {
    const first = [...segment.lines].sort((one, other) => lineOrder.indexOf(one) - lineOrder.indexOf(other))[0] ?? '';
    const path = simplify(segment.coordinates, tolerance).map(([lng, lat]): LngLat => [round(lng), round(lat)]);
    byLine.set(first, [...(byLine.get(first) ?? []), path]);
  }
  return [...byLine]
    .sort(([one], [other]) => lineOrder.indexOf(other) - lineOrder.indexOf(one))
    .map(([id, paths]) => ({ color: lines[id]?.color ?? 'currentColor', darkColor: lines[id]?.darkColor ?? lines[id]?.color ?? 'currentColor', paths }));
};

/**
 * One city, summed up for the index: its own lines, how many stations, when it began, and its track.
 * A network never built is summed up by its first plan.
 *
 * @param network - The city's network.
 * @param country - Its country's folder in `cities/`.
 * @returns The city's entry.
 */
export const indexEntryOf = (network: Network, country: string): CityIndexEntry => {
  const planOnly = isPlanOnly(network);
  const shown = planOnly ? buildPlan(network, Object.keys(network.plans ?? {})[0] ?? '').network : network;
  const opened = network.segments.flatMap(segment => Object.values(segment.lines).map(dates => dates.open)).sort()[0];
  return {
    name: network.meta.city,
    country,
    networks: Object.values(network.networks).map(brand => brand.name),
    openedYear: opened ? Number(opened.slice(0, 4)) : null,
    planOnly,
    plans: Object.keys(network.plans ?? {}).length,
    lines: Object.entries(shown.lines)
      .filter(([, line]) => !line.pseudo)
      .map(([id, line]) => ({ id, name: line.name, color: line.color, darkColor: line.darkColor ?? line.color })),
    stations: Object.keys(shown.stations).length,
    track: indexedTrack(network),
  };
};

/**
 * The index as it is kept in `cities/cities.json`: one city per line, so it diffs city by city.
 *
 * @param index - The index.
 * @returns The file's text.
 */
export const formatCityIndex = (index: CityIndex): string =>
  `{\n${Object.entries(index)
    .map(([city, entry]) => `  ${JSON.stringify(city)}: ${JSON.stringify(entry)}`)
    .join(',\n')}\n}\n`;
