import { keysOf } from '@railtime/core/collection.utils';
import { toIsoDate } from '@railtime/core/date.utils';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { Moment, Playhead } from '@railtime/network/facts.types';
import { ADDRESS_SETTINGS } from '~/features/explorer/address/address.constants';
import type { AddressInput, ExplorerQuery, ExplorerSettings, ExplorerUrlState, RouteLink } from '~/features/explorer/address/address.types';
import { SECTIONS } from '~/features/explorer/explorer.constants';
import type { Section } from '~/features/explorer/explorer.types';

/** A moment: a day, or `plan` for a plan's changes; then how many of them are done and the next one's progress in hundredths, unless all are: `1935-06-01`, `1935-06-01,2.4`, `plan,1`. */
const MOMENT = /^(?:(\d{4})-(\d{2})-(\d{2})|plan)(?:,(\d+)(?:\.(\d{1,2}))?)?$/;
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
 * @param text - `1935-06-01`, `1935-06-01,2.4`, `plan,1`.
 * @returns The moment, or nothing if it is malformed or its day is no day.
 */
const parseMoment = (text: string): Moment | undefined => {
  const match = MOMENT.exec(text);
  if (!match) return undefined;
  const [, year, month, date, done, hundredths] = match;
  const partway = done === undefined ? {} : { partway: { done: Number(done), progress: hundredths === undefined ? 0 : Number(`0.${hundredths}`) } };
  if (year === undefined) return { day: null, ...partway };
  const day = Date.UTC(Number(year), Number(month) - 1, Number(date));
  // Date.UTC rolls 31 February over into March: refuse what does not round-trip.
  return new Date(day).toISOString().startsWith(`${year}-${month}-${date}`) ? { day, ...partway } : undefined;
};

/**
 * Writes an `at` parameter.
 *
 * @param moment - The moment.
 * @returns `1935-06-01`, `1935-06-01,2.4`, `plan,1`.
 */
const formatMoment = ({ day, partway }: Moment): string => {
  const when = day === null ? 'plan' : toIsoDate(day);
  if (!partway) return when;
  if (partway.progress === 0) return `${when},${partway.done}`;
  // A moment's progress is already to the hundredth: its decimals as they are, 0.4 `.4`, 0.05 `.05`.
  return `${when},${partway.done}.${String(partway.progress).slice(2)}`;
};

/**
 * The moment an address names for where the map is, to the hundredth of a change (`Playheads.toHundredth`)
 * and to the day: none where the map rests (`Playheads.rest`).
 *
 * @param playhead - Where the map is.
 * @param playheads - The network's playheads.
 * @returns The moment to name, or `null` for none.
 */
export const linkedMomentOf = (playhead: Playhead, playheads: NetworkFacts['playheads']): Moment | null => {
  const named = playheads.toHundredth(playhead);
  return playheads.isRest(named) ? null : playheads.moment(named);
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
 * Where an address puts the map: its moment and its view.
 *
 * @param query - The address's query.
 * @returns Its `at` and `view`, each where well formed.
 */
const parsePosition = (query: ExplorerQuery): Pick<ExplorerUrlState, 'at' | 'view'> => {
  const moment = parseMoment(single(query.at) ?? '');
  const view = parseView(single(query.map) ?? '');
  return { ...(moment && { at: moment }), ...(view && { view }) };
};

/**
 * What an address has open: a station, a plan, the section, a route, a reach, a line.
 *
 * @param query - The address's query.
 * @returns Each where well formed.
 */
const parseOpened = (query: ExplorerQuery): Omit<ExplorerUrlState, keyof ExplorerSettings | 'at' | 'view'> => {
  const station = single(query.station);
  const plan = single(query.plan);
  const section = parseSection(single(query.tab));
  const route = parseRoute(single(query.route) ?? '');
  const reach = single(query.reach);
  const line = single(query.line);
  return {
    ...(station && SLUG.test(station) && { station }),
    ...(plan && SLUG.test(plan) && { plan }),
    ...(section && { section }),
    ...(route && { route }),
    ...(reach && SLUG.test(reach) && { reach }),
    ...(line && SLUG.test(line) && { line }),
  };
};

/**
 * A setting an address holds.
 *
 * @param key - The setting.
 * @param query - The address's query.
 * @returns What it says, if it is one offered; else the setting's default.
 */
const settingOf = <Key extends keyof ExplorerSettings>(key: Key, query: ExplorerQuery): ExplorerSettings[Key] => {
  const { param, fallback, offered } = ADDRESS_SETTINGS[key];
  const text = single(query[param]);
  return offered.find(entry => entry[0] === text)?.[1] ?? fallback;
};

/**
 * How an address has a page set.
 *
 * @param query - The address's query.
 * @returns Every setting: what it says, else the default.
 */
const parseSettings = (query: ExplorerQuery): ExplorerSettings => ({
  walk: settingOf('walk', query),
  viewMode: settingOf('viewMode', query),
  stationNames: settingOf('stationNames', query),
  streetNames: settingOf('streetNames', query),
  trains: settingOf('trains', query),
  mapOnly: settingOf('mapOnly', query),
  panelOpen: settingOf('panelOpen', query),
  speed: settingOf('speed', query),
  camera: settingOf('camera', query),
  minimap: settingOf('minimap', query),
});

/**
 * Reads an explorer address. Anything malformed is left out, so a bad link opens the default.
 *
 * @param query - The address's query: `at`, `map`, `station`, `plan`, `tab`, `route`, `reach`, `line`, and the settings' (`ADDRESS_SETTINGS`).
 * @returns What it asks for, every setting with it.
 */
export const parseExplorerQuery = (query: ExplorerQuery): ExplorerUrlState => ({
  ...parsePosition(query),
  ...parseOpened(query),
  ...parseSettings(query),
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
 * Writes where the map is: its moment and its view.
 *
 * @param state - What the address shows.
 * @returns The `at` and `map` parameters, each where there is one.
 */
const formatPosition = ({ at, view }: ExplorerUrlState): Record<string, string> => ({
  ...(at && { at: formatMoment(at) }),
  ...(view && { map: `${view.zoom.toFixed(2)}/${view.center[1].toFixed(5)}/${view.center[0].toFixed(5)}` }),
});

/**
 * Writes what is open: a station, a plan, the section, a route, a reach, a line.
 *
 * @param state - What the address shows.
 * @returns Their parameters, each where there is one.
 */
const formatOpened = (state: ExplorerUrlState): Record<string, string> => {
  const { station, plan, section, route, reach, line } = state;
  return {
    ...(station && { station }),
    ...(plan && { plan }),
    ...(section && { tab: section }),
    ...(route && { route: formatRoute(route) }),
    ...(reach && { reach }),
    ...(line && { line }),
  };
};

/**
 * Writes a setting.
 *
 * @param key - The setting.
 * @param value - What it is.
 * @returns Its parameter and value, or none for its default.
 */
const settingParam = <Key extends keyof ExplorerSettings>(key: Key, value: ExplorerSettings[Key]): [string, string][] => {
  const { param, fallback, offered } = ADDRESS_SETTINGS[key];
  return value === fallback ? [] : offered.filter(entry => entry[1] === value).map(entry => [param, entry[0]]);
};

/**
 * Writes an explorer address, rounded to what a link needs: zoom to 0.01, coordinates to ~1 m.
 *
 * @param state - What it shows.
 * @returns The query.
 */
export const formatExplorerQuery = (state: ExplorerUrlState): Record<string, string> => ({
  ...formatPosition(state),
  ...formatOpened(state),
  ...Object.fromEntries(keysOf<keyof ExplorerSettings, unknown>(ADDRESS_SETTINGS).flatMap(key => settingParam(key, state[key]))),
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
  return { ...(from && { from }), ...(to && { to }), ...(input.routeOption > 0 && { option: input.routeOption }) };
};

/**
 * What the stores have open, for the address: a station, a plan, the section, a route, a reach, a line.
 *
 * @param input - What the stores hold.
 * @returns Each that is set and not as a page opens without it.
 */
const openedOf = (input: AddressInput): Omit<ExplorerUrlState, keyof ExplorerSettings | 'at' | 'view'> => {
  const route = routeLinkOf(input);
  return {
    ...(input.openStation && { station: input.openStation }),
    ...(input.plan && { plan: input.plan }),
    ...(input.section !== input.openingSection && { section: input.section }),
    ...(route && { route }),
    ...(input.reachFrom && { reach: input.reachFrom }),
    ...(input.openLine && { line: input.openLine }),
  };
};

/**
 * What the explorer's address says of what it shows: everything a link needs to open it again, what
 * is open left out where it is as a page opens without it (the section a page opens on), and its settings.
 *
 * @param input - What the stores hold.
 * @returns The address's state, for `formatExplorerQuery`, which leaves out each setting at its default.
 */
export const explorerAddressOf = (input: AddressInput): ExplorerUrlState => ({
  ...(input.at && { at: input.at }),
  ...(input.view && { view: input.view }),
  ...openedOf(input),
  ...input.settings,
});
