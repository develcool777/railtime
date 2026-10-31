import type { RoutePreference, RouteStop, Theme } from '@railtime/network/facts.types';
import type { MapProps, OverlayRequest, Padding, ViewMode } from '@railtime/renderer/transitMap.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';

import type { Chrome, MapOverlay, PanelView, PlayerSettings, RouteEnds, Section, SheetSnap, TimeMode } from '~/features/explorer/explorer.types';

/**
 * Opens a station's view: over a line's view, if one is open, in place of any stations walked before.
 *
 * @param views - The views pushed now.
 * @param id - The station.
 * @returns The views pushed after.
 */
export const withStation = (views: PanelView[], id: string): PanelView[] => [...views.filter(view => view.kind === 'line'), { kind: 'station', id }];

/**
 * Walks from the station whose view is open to another along its line: Back returns to the one left.
 *
 * @param views - The views pushed now.
 * @param id - The station walked to.
 * @returns The views pushed after; the same if it is the station open.
 */
export const walkedTo = (views: PanelView[], id: string): PanelView[] => {
  const top = views.at(-1);
  return top?.kind === 'station' && top.id !== id ? [...views, { kind: 'station', id }] : views;
};

/**
 * Closes the stations' views, back to the line's under them, if any.
 *
 * @param views - The views pushed now.
 * @returns The views pushed after.
 */
export const withoutStations = (views: PanelView[]): PanelView[] => views.filter(view => view.kind === 'line');

/**
 * The id of the last view of a kind pushed, if it is on top: the station open, or the line under it.
 *
 * @param views - The views pushed.
 * @param kind - A station's or a line's.
 * @returns Its id, or `null`.
 */
export const openOf = (views: PanelView[], kind: PanelView['kind']): string | null => views.findLast(view => view.kind === kind)?.id ?? null;

/**
 * The section the rail marks: the one a pushed view belongs to (a station's view Stations', a line's
 * Lines'), else the one open.
 *
 * @param section - The section open.
 * @param views - The views pushed over it.
 * @returns The section to mark.
 */
export const railSectionOf = (section: Section, views: PanelView[]): Section => {
  const top = views.at(-1);
  if (!top) return section;
  return top.kind === 'station' ? 'stations' : 'lines';
};

/**
 * What the map draws over the network for the section open. Playback hides a route and a reach, which
 * would cover the line growing and fade the network it is drawn over; coverage, which grows with the
 * network, stays.
 *
 * @param section - The section open.
 * @param timeMode - What the time control shows.
 * @returns The overlay, or `null` for none.
 */
export const mapOverlayOf = (section: Section, timeMode: TimeMode): MapOverlay | null => {
  if (section === 'coverage') return 'coverage';
  if (timeMode === 'playing') return null;
  return section === 'route' || section === 'reach' ? section : null;
};

/** What the map's overlay is worked out from: which one, and what each is of. */
type OverlayInput = {
  overlay: MapOverlay | null;
  routeEnds: RouteEnds;
  routePreference: RoutePreference;
  reachFrom: RouteStop | null;
};

/**
 * What to ask the map to draw over the network: the overlay of the section open, once it has what it
 * needs (a route both its ends, a reach its start).
 *
 * @param input - The overlay, the route's ends and preference, the reach's start.
 * @returns The request, or `null` for nothing to draw.
 */
export const overlayRequestOf = (input: OverlayInput): OverlayRequest | null => {
  const { overlay, routeEnds, routePreference, reachFrom } = input;
  if (overlay === 'coverage') return { kind: 'coverage' };
  if (overlay === 'route' && routeEnds.from && routeEnds.to)
    return { kind: 'route', from: routeEnds.from.id, to: routeEnds.to.id, preference: routePreference };
  if (overlay === 'reach' && reachFrom) return { kind: 'reach', from: reachFrom.id };
  return null;
};

/** What the page's chrome is worked out from. */
type ChromeInput = {
  phone: boolean;
  mapOnly: boolean;
  sheet: SheetSnap;
  timeMode: TimeMode;
  /** The minimap is wanted while history plays. */
  minimap: boolean;
};

/**
 * What the page shows around the map. Map only hides it all; on a phone there is no rail, the time
 * control gives way to the sheet at full height, and the minimap does not fit.
 *
 * @param input - The layout, the time control's mode, and the minimap's setting.
 * @returns What shows.
 */
export const chromeOf = (input: ChromeInput): Chrome => {
  const { phone, mapOnly, sheet, timeMode, minimap } = input;
  const shown = !mapOnly;
  // Beside the map the line stays even in map only; a phone's button goes with the rest.
  let credits: Chrome['credits'] = 'line';
  if (phone) credits = shown ? 'button' : null;
  return {
    header: shown,
    rail: shown && !phone,
    panel: shown,
    tools: shown,
    timeControl: shown && !(phone && sheet === 'full'),
    minimap: shown && !phone && timeMode === 'playing' && minimap,
    credits,
  };
};

/** What the map's props are worked out from: the store's state, and the theme. */
type MapPropsInput = {
  theme: Theme;
  viewMode: ViewMode;
  stationNames: boolean;
  visibleLines: string[] | null;
  timeMode: TimeMode;
  openStation: string | null;
  openLine: string | null;
  overlay: OverlayRequest | null;
  boundary: CityBoundary | null;
  player: PlayerSettings;
  padding: Padding;
  panelCover: number;
};

/**
 * The map's props: everything the map shows, as the store has it, in one place. The line open is
 * brought forward, but not under a station's view or while playing, when every line is alike.
 *
 * @param input - The store's state, and the theme.
 * @returns The props.
 */
export const mapPropsOf = (input: MapPropsInput): MapProps => ({
  theme: input.theme,
  viewMode: input.viewMode,
  stationLabels: input.stationNames,
  visibleLines: input.visibleLines,
  focusedLines: input.timeMode === 'playing' || input.openStation || !input.openLine ? null : [input.openLine],
  selectedStation: input.openStation,
  overlay: input.overlay,
  boundary: input.boundary,
  speed: input.player.speed,
  camera: input.player.camera,
  padding: input.padding,
  cover: { top: 0, right: 0, bottom: 0, left: input.panelCover },
});
