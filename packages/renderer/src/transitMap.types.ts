import type { IsoDate, LngLat, Network } from '@railtime/schema/network.types';
import type { Step } from './model/timeline.types';

/** The map's colour theme. */
export type Theme = 'dark' | 'light';

/** `follow` frames each change, `overview` the change plus the network so far, `free` leaves the camera alone. */
export type CameraMode = 'follow' | 'overview' | 'free';

/** Room around the map's edges that the camera keeps clear, in pixels. */
export type Padding = { top: number; bottom: number; left: number; right: number };

/** Where the map looks. */
export type MapView = { center: LngLat; zoom: number };

/** What a `TransitMap` is created with. */
export type TransitMapOptions = {
  container: HTMLElement;
  network: Network;
  theme?: Theme;
  /** A MapLibre style URL using the OpenMapTiles schema. Defaults to OpenFreeMap's Positron. */
  basemap?: string;
  /** Where to draw the overview inset. Without one there is no minimap. */
  minimapContainer?: HTMLElement;
  /** Room the app's own panels take up, kept clear when the camera frames something. */
  padding?: Padding;
  /** Where the map opens. Without one it fits the whole network. */
  view?: MapView;
  /** One of the network's plans, built on top of it: its changes play after today, drawn as planned. */
  plan?: string;
  /**
   * Where MapLibre's worker script is served. A bundler that moves MapLibre (Vite does) breaks the
   * path it works out itself, so the app passes the URL its bundler gives the file.
   */
  workerUrl?: string;
};

/** What is on the map. */
export type NetworkStats = { stations: number; km: number; lines: number };

/** Where playback is. */
export type TimeState = {
  /** The clock, as a UTC timestamp. */
  time: number;
  /** Steps that have happened. Equal to `todayCursor` on today's map, and above it in a planned future. */
  cursor: number;
  stepCount: number;
  /** Steps that have happened by today: those after are planned. */
  todayCursor: number;
  playing: boolean;
  stats: NetworkStats;
};

/** The change playing now, for a caption. */
export type StepInfo = {
  kind: Step['kind'];
  time: number;
  title: string;
  /** The first and last station it reaches: "<station> – <station>". */
  subtitle?: string;
  color: string;
  /** Stations this step opens, in the order they appear. */
  stations: string[];
  /** It is planned, not yet happened. */
  planned?: boolean;
};

/** One line at a station, for a station panel. */
export type StationLineInfo = { id: string; name: string; color: string; opened: IsoDate; closed?: IsoDate };

/** A station, for a station panel. */
export type StationInfo = {
  id: string;
  /** Its name on the date shown. */
  name: string;
  /** That name in the network's other languages. */
  otherNames: string[];
  lines: StationLineInfo[];
  /** The names it had before the date shown, oldest first. */
  formerNames: FormerNameInfo[];
  /** Stations to change to from here, on the date shown. */
  transfers: TransferInfo[];
};

/** A name a station had, with its names in other languages, and the day it changed. */
export type FormerNameInfo = { name: string; otherNames: string[]; until: IsoDate };

/** A station to change to, and the lines it has on the date shown. */
export type TransferInfo = { id: string; name: string; lines: { id: string; name: string; color: string }[] };

/** A line, for a legend or toggles. */
export type LineInfo = { id: string; name: string; network: string; networkName: string; color: string };

/** Events a `TransitMap` emits, by name. */
export type TransitMapEvents = {
  /** The basemap and overlay are ready. */
  ready: undefined;
  /** The clock, cursor, playing state or stats changed. */
  time: TimeState;
  /** A step started (`StepInfo`), or its caption should go (`null`). */
  step: StepInfo | null;
  /** How many of the current step's stations have appeared. */
  stepProgress: number;
  /** A station was clicked; or the map away from any station, or the selected one left the map (`null`). */
  stationClick: StationInfo | null;
  /** Playback reached today. */
  end: undefined;
  /** The map stopped moving, by the user's hand or the camera's: where it looks now. */
  view: MapView;
};
