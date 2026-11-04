import { DAY_MS, toIsoDate } from '@railtime/core/date.utils';
import { COVERAGE_DEFAULT_METRES } from '@railtime/network/coverage.constants';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { Playhead } from '@railtime/network/facts.types';
import type { AddressInput, ExplorerQuery, ExplorerUrlState, LinkedPlayhead, RouteLink } from '~/features/explorer/address/address.types';
import { coverageDistanceOf } from '~/features/explorer/coverage/coverage.utils';
import { SECTIONS } from '~/features/explorer/explorer.constants';
import type { Section } from '~/features/explorer/explorer.types';
import { CAMERA_OPTIONS, DEFAULT_PLAYER, SPEED_OPTIONS } from '~/features/explorer/time/time.constants';

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
 * A `route` parameter: `<from>,<to>[,<option>]`, either end empty until picked.
 *
 * @param text - The parameter.
 * @returns The route, or nothing for one with no end.
 */
const parseRoute = (text: string): RouteLink | undefined => {
  const [from = '', to = '', optionText] = text.split(',', 3);
  const option = Number(optionText);
  const link: RouteLink = {
    ...(SLUG.test(from) && { from }),
    ...(SLUG.test(to) && { to }),
    ...(Number.isSafeInteger(option) && option > 0 && { option }),
  };
  return link.from || link.to ? link : undefined;
};

/**
 * Writes a `route` parameter.
 *
 * @param link - The route.
 * @returns `<from>,<to>`, and `,<option>` after the fastest.
 */
const formatRoute = (link: RouteLink): string =>
  [link.from ?? '', link.to ?? '', ...(link.option !== undefined && link.option > 0 ? [String(link.option)] : [])].join(',');

/**
 * Where an address puts the map: its playhead and its view.
 *
 * @param query - The address's query.
 * @returns Its `at` and `view`, each where well formed.
 */
const parsePosition = (query: ExplorerQuery): ExplorerUrlState => {
  const playhead = parsePlayhead(single(query.at) ?? '');
  const view = parseView(single(query.map) ?? '');
  return { ...(playhead && { at: playhead }), ...(view && { view }) };
};

/**
 * What an address has open: a station, a plan, the section, the walk, a route, a reach, a line.
 *
 * @param query - The address's query.
 * @returns Each where well formed and not the default.
 */
const parseOpened = (query: ExplorerQuery): ExplorerUrlState => {
  const station = single(query.station);
  const plan = single(query.plan);
  const section = parseSection(single(query.tab));
  const walk = coverageDistanceOf(single(query.walk));
  const route = parseRoute(single(query.route) ?? '');
  const reach = single(query.reach);
  const line = single(query.line);
  return {
    ...(station && SLUG.test(station) && { station }),
    ...(plan && SLUG.test(plan) && { plan }),
    ...(section && { section }),
    ...(walk !== undefined && walk !== COVERAGE_DEFAULT_METRES && { walk }),
    ...(route && { route }),
    ...(reach && SLUG.test(reach) && { reach }),
    ...(line && SLUG.test(line) && { line }),
  };
};

/**
 * How an address has the map seen: in 3D, names hidden, the map alone, the panel folded.
 *
 * @param query - The address's query.
 * @returns Each that is not the default.
 */
const parseLook = (query: ExplorerQuery): ExplorerUrlState => ({
  ...(single(query.view) === '3d' && { viewMode: '3d' as const }),
  ...(single(query.names) === 'off' && { stationNames: false as const }),
  ...(single(query.streets) === 'off' && { streetNames: false as const }),
  ...(single(query.mapOnly) === '1' && { mapOnly: true as const }),
  ...(single(query.panel) === 'off' && { panelOpen: false as const }),
});

/**
 * Playback's settings an address names: its speed, its camera, the minimap.
 *
 * @param query - The address's query.
 * @returns Each that is one offered and not the default.
 */
const parsePlayer = (query: ExplorerQuery): ExplorerUrlState => {
  const speed = SPEED_OPTIONS.find(option => String(option.value) === single(query.speed))?.value;
  const camera = CAMERA_OPTIONS.find(option => option.value === single(query.camera))?.value;
  return {
    ...(speed !== undefined && speed !== DEFAULT_PLAYER.speed && { speed }),
    ...(camera && camera !== DEFAULT_PLAYER.camera && { camera }),
    ...(single(query.minimap) === 'off' && { minimap: false as const }),
  };
};

/**
 * Reads an explorer address. Anything malformed is left out, so a bad link opens the default.
 *
 * @param query - The address's query: `at`, `map`, `station`, `plan`, `tab`, `walk`, `route`, `reach`, `line`, `view`, `names`, `streets`, `mapOnly`, `panel`, `speed`, `camera`, `minimap`.
 * @returns What it asks for.
 */
export const parseExplorerQuery = (query: ExplorerQuery): ExplorerUrlState => ({
  ...parsePosition(query),
  ...parseOpened(query),
  ...parseLook(query),
  ...parsePlayer(query),
});

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
 * Writes where the map is: its playhead and its view.
 *
 * @param state - What the address shows.
 * @returns The `at` and `map` parameters, each where there is one.
 */
const formatPosition = ({ at: playhead, view }: ExplorerUrlState): Record<string, string> => ({
  ...(playhead && { at: formatPlayhead(playhead) }),
  ...(view && { map: `${view.zoom.toFixed(2)}/${view.center[1].toFixed(5)}/${view.center[0].toFixed(5)}` }),
});

/**
 * Writes what is open: a station, a plan, the section, the walk, a route, a reach, a line.
 *
 * @param state - What the address shows.
 * @returns Their parameters, each where there is one.
 */
const formatOpened = (state: ExplorerUrlState): Record<string, string> => {
  const { station, plan, section, walk, route, reach, line } = state;
  return {
    ...(station && { station }),
    ...(plan && { plan }),
    ...(section && { tab: section }),
    ...(walk !== undefined && { walk: String(walk) }),
    ...(route && { route: formatRoute(route) }),
    ...(reach && { reach }),
    ...(line && { line }),
  };
};

/**
 * Writes how the map is seen: in 3D, names hidden, the map alone, the panel folded.
 *
 * @param state - What the address shows.
 * @returns Their parameters, each where it is not the default.
 */
const formatLook = (state: ExplorerUrlState): Record<string, string> => {
  const { viewMode, stationNames, streetNames, mapOnly, panelOpen } = state;
  return {
    ...(viewMode === '3d' && { view: '3d' }),
    ...(stationNames === false && { names: 'off' }),
    ...(streetNames === false && { streets: 'off' }),
    ...(mapOnly && { mapOnly: '1' }),
    ...(panelOpen === false && { panel: 'off' }),
  };
};

/**
 * Writes playback's settings: its speed, its camera, the minimap.
 *
 * @param state - What the address shows.
 * @returns Their parameters, each where there is one.
 */
const formatPlayer = ({ speed, camera, minimap }: ExplorerUrlState): Record<string, string> => ({
  ...(speed !== undefined && { speed: String(speed) }),
  ...(camera && { camera }),
  ...(minimap === false && { minimap: 'off' }),
});

/**
 * Writes an explorer address, rounded to what a link needs: zoom to 0.01, coordinates to ~1 m.
 *
 * @param state - What it shows.
 * @returns The query.
 */
export const formatExplorerQuery = (state: ExplorerUrlState): Record<string, string> => ({
  ...formatPosition(state),
  ...formatOpened(state),
  ...formatLook(state),
  ...formatPlayer(state),
});

/**
 * The route the address names: its ends, and the way drawn after the fastest.
 *
 * @param input - What the stores hold.
 * @returns The route, or nothing while neither end is picked.
 */
const routeLinkOf = (input: AddressInput): RouteLink | undefined => {
  const { from, to } = input.routeEnds;
  if (!(from ?? to)) return undefined;
  return { ...(from && { from: from.id }), ...(to && { to: to.id }), ...(input.routeOption > 0 && { option: input.routeOption }) };
};

/**
 * What the stores have open, for the address: a station, a plan, the section, the walk, a route, a reach, a line.
 *
 * @param input - What the stores hold.
 * @returns Each that is set and not as a page opens without it.
 */
const openedOf = (input: AddressInput): ExplorerUrlState => {
  const route = routeLinkOf(input);
  return {
    ...(input.openStation && { station: input.openStation }),
    ...(input.plan && { plan: input.plan }),
    ...(input.section !== input.openingSection && { section: input.section }),
    ...(input.coverageMetres !== COVERAGE_DEFAULT_METRES && { walk: input.coverageMetres }),
    ...(route && { route }),
    ...(input.reachFrom && { reach: input.reachFrom.id }),
    ...(input.openLine && { line: input.openLine }),
  };
};

/**
 * How the stores have the map seen, for the address: in 3D, names hidden, the map alone, the panel folded.
 *
 * @param input - What the stores hold.
 * @returns Each that is not the default.
 */
const lookOf = (input: AddressInput): ExplorerUrlState => ({
  ...(input.viewMode === '3d' && { viewMode: '3d' as const }),
  ...(!input.stationNames && { stationNames: false as const }),
  ...(!input.streetNames && { streetNames: false as const }),
  ...(input.mapOnly && { mapOnly: true as const }),
  ...(!input.panelOpen && { panelOpen: false as const }),
});

/**
 * Playback's settings, for the address: its speed, its camera, the minimap.
 *
 * @param input - What the stores hold.
 * @returns Each that is not the default.
 */
const playerOf = ({ player }: AddressInput): ExplorerUrlState => ({
  ...(player.speed !== DEFAULT_PLAYER.speed && { speed: player.speed }),
  ...(player.camera !== DEFAULT_PLAYER.camera && { camera: player.camera }),
  ...(!player.minimap && { minimap: false as const }),
});

/**
 * What the explorer's address says of what it shows: everything a link needs to open it again, each
 * left out where it is as a page opens without it (the section a page opens on, the walk, playback's
 * settings, names shown, 2D).
 *
 * @param input - What the stores hold.
 * @returns The address's state, for `formatExplorerQuery`.
 */
export const explorerAddressOf = (input: AddressInput): ExplorerUrlState => ({
  ...(input.at && { at: input.at }),
  ...(input.view && { view: input.view }),
  ...openedOf(input),
  ...lookOf(input),
  ...playerOf(input),
});
