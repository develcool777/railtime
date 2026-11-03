import { COVERAGE_DEFAULT_METRES } from '@railtime/network/coverage.constants';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { Playhead } from '@railtime/network/facts.types';
import { DAY_MS, toIsoDate } from '@railtime/core/date.utils';
import { coverageDistanceOf } from '~/features/explorer/coverage/coverage.utils';
import type { ExplorerQuery, ExplorerUrlState, LinkedPlayhead } from '~/features/explorer/address/address.types';
import { SECTIONS } from '~/features/explorer/explorer.constants';
import type { Section } from '~/features/explorer/explorer.types';

/** A playhead: its cursor, the next change's progress in hundredths or the day the clock is on, `202.4` or `202,1928-06-01`. */
const PLAYHEAD = /^(\d+)(?:\.(\d{1,2})|,(\d{4})-(\d{2})-(\d{2}))?$/;
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
 * An `at` parameter, read whole or not at all.
 *
 * @param text - `202`, `202.4` or `202,1928-06-01`.
 * @returns The playhead, or nothing if it is malformed or its day is no day.
 */
const parsePlayhead = (text: string): LinkedPlayhead | undefined => {
  const match = PLAYHEAD.exec(text);
  if (!match) return undefined;
  const [, cursor, hundredths, year, month, day] = match;
  const progress = hundredths === undefined ? 0 : Number(`0.${hundredths}`);
  if (year === undefined) return { cursor: Number(cursor), progress };
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day));
  // Date.UTC rolls 31 February over into March: refuse what does not round-trip.
  return new Date(time).toISOString().startsWith(`${year}-${month}-${day}`) ? { cursor: Number(cursor), progress, time } : undefined;
};

/**
 * Writes an `at` parameter.
 *
 * @param playhead - The playhead, as the address holds it.
 * @returns `202`, `202.4` or `202,1928-06-01`.
 */
const formatPlayhead = (playhead: LinkedPlayhead): string => {
  const { cursor, progress, time } = playhead;
  // Hundredths, as a decimal's: 0.4 is `.4`, 0.05 is `.05`.
  const hundredths = String(Math.round(progress * 100))
    .padStart(2, '0')
    .replace(/0$/, '');
  if (progress > 0) return `${cursor}.${hundredths}`;
  return time === undefined ? String(cursor) : `${cursor},${toIsoDate(time)}`;
};

/**
 * The playhead an address names: its time, where left out, the one its cursor and progress imply.
 *
 * @param linked - The playhead, as the address holds it.
 * @param playheads - The network's playheads.
 * @returns The playhead, for the map to seek: it holds the cursor to the timeline and the clock to its change's years.
 */
export const playheadOf = (linked: LinkedPlayhead, playheads: NetworkFacts['playheads']): Playhead => {
  const implied = playheads.after(linked.cursor, linked.progress);
  return linked.time === undefined ? implied : { ...implied, time: linked.time };
};

/**
 * The playhead an address names for where the map is, to the hundredth of a change and to the day:
 * none where the map rests (`Playheads.rest`), its time only where its cursor and progress do not
 * imply it. A change drawn whole is done.
 *
 * @param playhead - Where the map is.
 * @param playheads - The network's playheads: where the map rests, and the time each implies.
 * @returns The playhead to name, or `null` for none.
 */
export const linkedPlayheadOf = (playhead: Playhead, playheads: NetworkFacts['playheads']): LinkedPlayhead | null => {
  const hundredths = Math.round(playhead.progress * 100);
  const rounded = hundredths >= 100 ? playheads.after(playhead.cursor + 1) : { ...playhead, progress: hundredths / 100 };
  if (playheads.isRest(rounded)) return null;
  const { cursor, progress, time } = rounded;
  const impliedDay = Math.floor(playheads.after(cursor, progress).time / DAY_MS);
  return progress > 0 || Math.floor(time / DAY_MS) === impliedDay ? { cursor, progress } : { cursor, progress, time };
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
 * @param query - The address's query: `at`, `map`, `station`, `plan`, `tab`, `walk`, `line`, `view`, `names`, `mapOnly`.
 * @returns What it asks for.
 */
export const parseExplorerQuery = (query: ExplorerQuery): ExplorerUrlState => {
  const playhead = parsePlayhead(single(query.at) ?? '');
  const view = parseView(single(query.map) ?? '');
  const station = single(query.station);
  const plan = single(query.plan);
  const section = parseSection(single(query.tab));
  const walk = coverageDistanceOf(single(query.walk));
  const line = single(query.line);
  return {
    ...(playhead ? { at: playhead } : {}),
    ...(view ? { view } : {}),
    ...(station && SLUG.test(station) ? { station } : {}),
    ...(plan && SLUG.test(plan) ? { plan } : {}),
    ...(section ? { section } : {}),
    ...(walk && walk !== COVERAGE_DEFAULT_METRES ? { walk } : {}),
    ...(line && SLUG.test(line) ? { line } : {}),
    ...(single(query.view) === '3d' ? { viewMode: '3d' as const } : {}),
    ...(single(query.names) === 'off' ? { stationNames: false as const } : {}),
    ...(single(query.streets) === 'off' ? { streetNames: false as const } : {}),
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
  const { at: playhead, view, station, plan, section, walk, line, viewMode, stationNames, streetNames, mapOnly } = state;
  return {
    ...(playhead ? { at: formatPlayhead(playhead) } : {}),
    ...(view ? { map: `${view.zoom.toFixed(2)}/${view.center[1].toFixed(5)}/${view.center[0].toFixed(5)}` } : {}),
    ...(station ? { station } : {}),
    ...(plan ? { plan } : {}),
    ...(section ? { tab: section } : {}),
    ...(walk ? { walk: String(walk) } : {}),
    ...(line ? { line } : {}),
    ...(viewMode === '3d' ? { view: '3d' } : {}),
    ...(stationNames === false ? { names: 'off' } : {}),
    ...(streetNames === false ? { streets: 'off' } : {}),
    ...(mapOnly ? { mapOnly: '1' } : {}),
  };
};
