import { parseBoundary } from '@railtime/schema/boundary.schema';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { Network } from '@railtime/schema/network.types';
import type { LngLat } from '@railtime/core/geometry.types';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import type { City } from '../city.types.ts';
import { citiesNamed, readNetwork } from '../city.utils.ts';
import { BOUNDARY_DECIMALS, MIN_STATIONS_HELD, NOMINATIM_LOOKUP, NOMINATIM_PAUSE_MS, SIMPLIFY_DEGREES, USER_AGENT } from './boundary.constants.ts';
import type { BoundaryArgs, NominatimPlace, OutlineGeometry } from './boundary.types.ts';

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

/** How `pnpm data:boundary` is run, said when it is run otherwise. */
const BOUNDARY_USAGE = 'usage: pnpm data:boundary [city [relation]], where relation is an OpenStreetMap id';

/**
 * What `pnpm data:boundary [city [relation]]` was asked for.
 *
 * @param args - Its arguments.
 * @returns The city and relation.
 * @throws {Error} With the usage, for a relation without a city, one that is not a whole number above 0, or more than two arguments.
 */
export const boundaryArgsOf = (args: string[]): BoundaryArgs => {
  const [city, relationText, ...rest] = args;
  if (rest.length > 0) throw new Error(BOUNDARY_USAGE);
  if (relationText === undefined) return { city, relation: null };
  const relation = Number(relationText);
  if (!Number.isInteger(relation) || relation <= 0) throw new Error(BOUNDARY_USAGE);
  return { city, relation };
};

/**
 * Fetches one city's outline from Nominatim and writes it, if the schema takes it and it is the city's.
 *
 * @param city - The city.
 * @param relationGiven - The relation to fetch it from; `null` for the one its outline names.
 * @throws {Error} If it is not written: no relation, Nominatim's answer, the schema, or an outline that is not the city's.
 */
const fetchBoundary = async (city: City, relationGiven: number | null): Promise<void> => {
  const kept: CityBoundary | null = existsSync(city.boundaryPath) ? parseBoundary(JSON.parse(readFileSync(city.boundaryPath, 'utf8'))) : null;
  const relation = relationGiven ?? (kept && relationOf(kept));
  if (!relation) throw new Error(`no outline yet: give its relation, pnpm data:boundary ${city.id} <relation>`);
  const response = await fetch(lookupUrlOf(relation), { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`relation ${relation} not fetched: Nominatim answered ${response.status}`);
  const [place] = (await response.json()) as NominatimPlace[];
  if (!place) throw new Error(`relation ${relation} not found on OpenStreetMap`);
  // A name chosen by hand (Greater London) stays while the relation does.
  const boundary = parseBoundary(boundaryOf(place, kept && relationOf(kept) === relation ? kept.name : undefined));
  const held = stationsHeld(boundary, readNetwork(city));
  if (held <= MIN_STATIONS_HELD) throw new Error(`relation ${relation} holds ${Math.round(held * 100)}% of the city's stations: is it the city's own?`);
  const text = formatBoundary(boundary);
  const changed = !existsSync(city.boundaryPath) || readFileSync(city.boundaryPath, 'utf8') !== text;
  writeFileSync(city.boundaryPath, text);
  const points = boundary.polygons.flat(2).length;
  console.log(
    `${city.id}: ${boundary.name}, relation ${relation}, ${points} points, ${Math.round(held * 100)}% of its stations, ${changed ? 'written' : 'unchanged'}`,
  );
};

/**
 * Fetches cities' outlines from OpenStreetMap through Nominatim, simplified, and writes each beside its
 * city's network: only one the schema takes and that holds most of the city's stations, so a wrong
 * relation changes nothing. A city that fails is said and passed over; the rest are fetched.
 *
 * @param cityId - The city's id; none for every city.
 * @param relation - The relation to fetch it from; `null` for the one each outline names.
 * @throws {Error} For no such city, a relation without one, or naming the cities not written.
 */
export const fetchBoundaries = async (cityId: string | undefined, relation: number | null): Promise<void> => {
  const chosen = citiesNamed(cityId);
  if (chosen.length === 0) throw new Error(`no city ${cityId}: ${BOUNDARY_USAGE}`);
  if (relation !== null && cityId === undefined) throw new Error(BOUNDARY_USAGE);
  const failed: string[] = [];
  for (const [position, city] of chosen.entries()) {
    // Nominatim's usage policy: a request a second at most.
    if (position > 0) await sleep(NOMINATIM_PAUSE_MS);
    try {
      await fetchBoundary(city, relation);
    } catch (error) {
      console.error(`${city.id}: not written: ${error instanceof Error ? error.message : String(error)}`);
      failed.push(city.id);
    }
  }
  if (failed.length > 0) throw new Error(`outlines not written: ${failed.join(', ')}`);
};
