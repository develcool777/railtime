import type { Chrome, PanelView, Section, SheetSnap, TimeMode } from '~/features/explorer/explorer.types';

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
