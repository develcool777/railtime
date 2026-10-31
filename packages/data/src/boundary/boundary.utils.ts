import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { LngLat, Network } from '@railtime/schema/network.types';
import { BOUNDARY_DECIMALS, NOMINATIM_LOOKUP, SIMPLIFY_DEGREES } from './boundary.constants.ts';
import type { NominatimPlace, OutlineGeometry } from './boundary.types.ts';

/**
 * Whether an outline holds a point: inside one of its polygons' outer rings and none of their holes.
 *
 * @param boundary - The outline.
 * @param point - The point.
 * @returns True if it does.
 */
export const holds = (boundary: CityBoundary, point: LngLat): boolean => {
  const [longitude, latitude] = point;
  const inRing = (ring: LngLat[]) =>
    ring.slice(0, -1).reduce((inside, [fromX, fromY], position) => {
      // Within bounds: a ring's next point, the last being the first.
      const [toX, toY] = ring[position + 1]!;
      return fromY > latitude !== toY > latitude && longitude < fromX + ((latitude - fromY) * (toX - fromX)) / (toY - fromY) ? !inside : inside;
    }, false);
  return boundary.polygons.some(([outer = [], ...holes]) => inRing(outer) && !holes.some(inRing));
};

/**
 * The share of a city's stations its outline holds: those built, or its plans' where nothing is.
 *
 * @param boundary - The outline.
 * @param network - The city's network.
 * @returns 0..1; 0 for a city with no stations at all.
 */
export const stationsHeld = (boundary: CityBoundary, network: Network): number => {
  const built = Object.values(network.stations);
  const stations = built.length > 0 ? built : Object.values(network.plans ?? {}).flatMap(plan => Object.values(plan.stations ?? {}));
  return stations.length > 0 ? stations.filter(station => holds(boundary, station.coordinate)).length / stations.length : 0;
};

/**
 * The OpenStreetMap relation an outline was taken from, as its source names it.
 *
 * @param boundary - The outline.
 * @returns The relation's id, or `null` if the source names none.
 */
export const relationOf = (boundary: Pick<CityBoundary, 'source'>): number | null => {
  const match = /relation (\d+)/.exec(boundary.source);
  return match ? Number(match[1]) : null;
};

/**
 * Where Nominatim gives a relation's outline, simplified, with its names.
 *
 * @param relation - The relation's id.
 * @returns The URL.
 */
export const lookupUrlOf = (relation: number): string =>
  `${NOMINATIM_LOOKUP}?osm_ids=R${relation}&format=json&polygon_geojson=1&polygon_threshold=${SIMPLIFY_DEGREES}&namedetails=1`;

/**
 * A coordinate kept to about a metre.
 *
 * @param value - Degrees.
 * @returns The same, rounded.
 */
const round = (value: number): number => Math.round(value * 10 ** BOUNDARY_DECIMALS) / 10 ** BOUNDARY_DECIMALS;

/**
 * A city's outline from what Nominatim gave for its relation.
 *
 * @param place - Nominatim's answer.
 * @param name - What to call the outline; its English name, else its own, if left out.
 * @returns The outline, its coordinates rounded, its source the relation.
 * @throws {Error} If the relation has no area: a line or a point.
 */
export const boundaryOf = (place: NominatimPlace, name?: string): CityBoundary => {
  const geometry = place.geojson;
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')
    throw new Error(`relation ${place.osm_id} is a ${geometry.type}, not an area: look for the city's administrative boundary`);
  const outline = geometry as OutlineGeometry;
  const polygons = outline.type === 'Polygon' ? [outline.coordinates] : outline.coordinates;
  return {
    name: name ?? place.namedetails?.['name:en'] ?? place.name,
    source: `© OpenStreetMap contributors, relation ${place.osm_id}`,
    polygons: polygons.map(polygon => polygon.map(ring => ring.map(([longitude, latitude]) => [round(longitude), round(latitude)]))),
  };
};

/**
 * An outline as its file keeps it: a ring to a line, so a change to one is a one-line diff.
 *
 * @param boundary - The outline.
 * @returns The file's text.
 */
export const formatBoundary = (boundary: CityBoundary): string => {
  const polygons = boundary.polygons.map(polygon => {
    const rings = polygon.map(ring => '      ' + JSON.stringify(ring));
    return `    [\n${rings.join(',\n')}\n    ]`;
  });
  return `{\n  "name": ${JSON.stringify(boundary.name)},\n  "source": ${JSON.stringify(boundary.source)},\n  "polygons": [\n${polygons.join(',\n')}\n  ]\n}\n`;
};
