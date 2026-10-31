import type { CameraMode } from '@railtime/renderer/transitMap.types';

/** One of the panel's sections, as the rail lists them. */
export type Section = 'lines' | 'stations' | 'changes' | 'route' | 'reach' | 'coverage' | 'insights' | 'plans';

/** A section as the rail lists it: its icon, and what it is for, as the help says. */
export type SectionEntry = { id: Section; label: string; icon: string; description: string };

/** How high the phone's sheet stands: its tabs only, half the screen, or all of it. */
export type SheetSnap = 'peek' | 'half' | 'full';

/** What the time control shows: the totals at rest, the timeline to pick a date, or the player. */
export type TimeMode = 'rest' | 'timeline' | 'playing';

/** A view pushed over the panel's section: a line's, or a station's. Back pops the last one. */
export type PanelView = { kind: 'line'; id: string } | { kind: 'station'; id: string };

/** What the map draws over the network for the panel's section: a route, a reach, or the city's coverage. */
export type MapOverlay = 'route' | 'reach' | 'coverage';

/** What opens over the whole page, one at a time: the search, the help, or the city picker. */
export type Overlay = 'search' | 'help' | 'cities';

/** What the page shows around the map, worked out in one place from the store. */
export type Chrome = {
  /** The site's header, with the city and the search. */
  header: boolean;
  /** The rail of sections beside the panel. */
  rail: boolean;
  /** The panel, or on a phone its sheet. */
  panel: boolean;
  /** The map's tools and the plan's legend. */
  tools: boolean;
  /** The time control. */
  timeControl: boolean;
  /** The minimap above the player. */
  minimap: boolean;
  /** The map's credits: a line in its corner, or folded into a button on a phone. Its licence asks for them. */
  credits: 'line' | 'button' | null;
};

/** How playback is set up: its speed, its camera, and whether the minimap shows; kept in a cookie. */
export type PlayerSettings = {
  speed: number;
  camera: CameraMode;
  minimap: boolean;
};
