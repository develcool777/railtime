import type { CameraMode } from '@railtime/renderer/transitMap.types';
import type { LineId, StationId } from '@railtime/schema/network.types';

/** One of the panel's sections, as the rail lists them. */
export type Section = 'lines' | 'stations' | 'changes' | 'route' | 'reach' | 'coverage' | 'insights' | 'plans';

/** A section as the rail lists it: its icon, and what it is for, as the help says. */
export type SectionEntry = { id: Section; label: string; icon: string; description: string };

/** How high the phone's sheet stands: its tabs only, half the screen, or all of it. */
export type SheetSnap = 'peek' | 'half' | 'full';

/** What the time control does: stands at a date, set on its timeline or paused at, or plays. */
export type TimeMode = 'timeline' | 'playing';

/** A view pushed over the panel's section: a line's, or a station's. Back pops the last one. */
export type PanelView = { kind: 'line'; id: LineId } | { kind: 'station'; id: StationId };

/** A dialog over the whole page, one at a time: the search, the help, or the city picker. */
export type Dialog = 'search' | 'help' | 'cities';

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

/** What the screen is, as the browser says: a phone's, and one wide enough for its tabs' names. */
export type ExplorerScreen = { phone: boolean; tabLabels: boolean };
