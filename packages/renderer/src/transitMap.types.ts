import type { IsoDate, Network } from '@railtime/schema/network.types';

/** The map's colour theme. */
export type Theme = 'dark' | 'light';

/** `follow` frames each change, `overview` the change plus the network so far, `free` leaves the camera alone. */
export type CameraMode = 'follow' | 'overview' | 'free';

/** Room around the map's edges that the camera keeps clear, in pixels. */
export type Padding = { top: number; bottom: number; left: number; right: number };

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
};

/** What is on the map. */
export type NetworkStats = { stations: number; km: number; lines: number };

/** Where playback is. */
export type TimeState = {
  /** The clock, as a UTC timestamp. */
  time: number;
  /** Steps that have happened. Equal to `stepCount` on today's map. */
  cursor: number;
  stepCount: number;
  playing: boolean;
  stats: NetworkStats;
};

/** The change playing now, for a caption. */
export type StepInfo = {
  kind: 'open' | 'close' | 'infill' | 'identity';
  time: number;
  title: string;
  /** e.g. "Walthamstow Central – Highbury & Islington". */
  subtitle?: string;
  color: string;
  /** Stations this step opens, in the order they appear. */
  stations: string[];
};

/** One line at a station, for a station panel. */
export type StationLineInfo = { id: string; name: string; color: string; opened: IsoDate; closed?: IsoDate };

/** A station, for a station panel. */
export type StationInfo = { id: string; name: string; lines: StationLineInfo[] };

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
  /** A station was clicked, or the map away from any station (`null`). */
  stationClick: StationInfo | null;
  /** Playback reached today. */
  end: undefined;
};
