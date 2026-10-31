import type { ExplorerQuery, ExplorerUrlState } from '~/features/explorer/address/address.types';
import { SECTIONS } from '~/features/explorer/explorer.constants';
import type { Section } from '~/features/explorer/explorer.types';

/** A day, `1935-06-01`, or a year, `1935`, read as the last day of that year. */
const DATE = /^(\d{4})(?:-(\d{2})-(\d{2}))?$/;
/** A station or plan id. */
const SLUG = /^[a-z0-9-]+$/;

/**
 * One value of a query parameter: the first, when it is given more than once.
 *
 * @param value - The router's value.
 * @returns The text, if there is one.
 */
const single = (value: ExplorerQuery[string]): string | undefined => (Array.isArray(value) ? value[0] : value) ?? undefined;

/**
 * A `date` parameter.
 *
 * @param text - `1935-06-01` or `1935`.
 * @returns The day's UTC midnight, or nothing if it is no day.
 */
const parseDate = (text: string): number | undefined => {
  const match = DATE.exec(text);
  if (!match) return undefined;
  const [, year, month = '12', day = '31'] = match;
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day));
  // Date.UTC rolls 31 February over into March: refuse what does not round-trip.
  return new Date(time).toISOString().startsWith(`${year}-${month}-${day}`) ? time : undefined;
};

/**
 * A `map` parameter, as OpenStreetMap writes it.
 *
 * @param text - `zoom/latitude/longitude`.
 * @returns The view, or nothing if it is out of range.
 */
const parseView = (text: string): ExplorerUrlState['view'] => {
  const [zoom, latitude, longitude, ...rest] = text.split('/').map(Number);
  if (zoom === undefined || latitude === undefined || longitude === undefined || rest.length > 0) return undefined;
  if (![zoom, latitude, longitude].every(Number.isFinite)) return undefined;
  if (zoom < 0 || zoom > 22 || Math.abs(latitude) > 85 || Math.abs(longitude) > 180) return undefined;
  return { center: [longitude, latitude], zoom };
};

/**
 * A `tab` parameter.
 *
 * @param text - A section's id.
 * @returns The section, or nothing if there is none of that name.
 */
const parseSection = (text: string | undefined): Section | undefined => SECTIONS.find(entry => entry.id === text)?.id;

/**
 * Reads an explorer address. Anything malformed is left out, so a bad link opens the default.
 *
 * @param query - The address's query: `date`, `map`, `station`, `plan`, `tab`, `line`, `view`, `names`, `mapOnly`.
 * @returns What it asks for.
 */
export const parseExplorerQuery = (query: ExplorerQuery): ExplorerUrlState => {
  const date = parseDate(single(query.date) ?? '');
  const view = parseView(single(query.map) ?? '');
  const station = single(query.station);
  const plan = single(query.plan);
  const section = parseSection(single(query.tab));
  const line = single(query.line);
  return {
    ...(date === undefined ? {} : { date }),
    ...(view ? { view } : {}),
    ...(station && SLUG.test(station) ? { station } : {}),
    ...(plan && SLUG.test(plan) ? { plan } : {}),
    ...(section ? { section } : {}),
    ...(line && SLUG.test(line) ? { line } : {}),
    ...(single(query.view) === '3d' ? { viewMode: '3d' as const } : {}),
    ...(single(query.names) === 'off' ? { stationNames: false as const } : {}),
    ...(single(query.mapOnly) === '1' ? { mapOnly: true as const } : {}),
  };
};

/**
 * Whether two queries say the same, whatever their keys' order.
 *
 * @param first - One query.
 * @param second - The other.
 * @returns True if they hold the same keys with the same values.
 */
export const sameQuery = (first: ExplorerQuery, second: ExplorerQuery): boolean => {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  return [...keys].every(key => JSON.stringify(first[key]) === JSON.stringify(second[key]));
};

/**
 * Writes an explorer address, rounded to what a link needs: zoom to 0.01, coordinates to ~1 m.
 *
 * @param state - What it shows.
 * @returns The query.
 */
export const formatExplorerQuery = (state: ExplorerUrlState): Record<string, string> => {
  const { date, view, station, plan, section, line, viewMode, stationNames, mapOnly } = state;
  return {
    ...(date === undefined ? {} : { date: new Date(date).toISOString().slice(0, 10) }),
    ...(view ? { map: `${view.zoom.toFixed(2)}/${view.center[1].toFixed(5)}/${view.center[0].toFixed(5)}` } : {}),
    ...(station ? { station } : {}),
    ...(plan ? { plan } : {}),
    ...(section ? { tab: section } : {}),
    ...(line ? { line } : {}),
    ...(viewMode === '3d' ? { view: '3d' } : {}),
    ...(stationNames === false ? { names: 'off' } : {}),
    ...(mapOnly ? { mapOnly: '1' } : {}),
  };
};
