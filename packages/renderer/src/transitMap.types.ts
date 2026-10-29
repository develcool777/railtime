import type { IsoDate, LngLat, Network } from '@railtime/schema/network.types';
import type { RoutePreference as ModelRoutePreference } from './model/routeFinder.types';
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
  /** One of the network's plans, built on top of it: its sections play after every dated change, one by one, drawn as planned (`showFuture`). */
  plan?: string;
  /**
   * Where MapLibre's worker script is served. A bundler that moves MapLibre (Vite does) breaks the
   * path it works out itself, so the app passes the URL its bundler gives the file.
   */
  workerUrl?: string;
  /** Whether MapLibre draws its credits on the map (the default). Without them the app must show `credits` itself, as the licences ask. */
  attributionControl?: boolean;
};

/** One credit the map owes: the basemap's or the data's. */
export type Credit = { text: string; url?: string };

/** What is on the map. */
export type NetworkStats = { stations: number; km: number; lines: number };

/** Where playback is. */
export type TimeState = {
  /** The clock, as a UTC timestamp. */
  time: number;
  /** Steps that have happened. Equal to `todayCursor` on today's map. */
  cursor: number;
  stepCount: number;
  /** Steps that have happened by today. */
  todayCursor: number;
  /** The map shows a plan's future: a planned step is playing or has played. `time` is then the end of the dates. */
  future: boolean;
  playing: boolean;
  stats: NetworkStats;
};

/** The change playing now, for a caption. */
export type StepInfo = {
  kind: Step['kind'];
  /** Its date; `null` for a planned step, which has none. */
  time: number | null;
  title: string;
  /** The first and last station it reaches: "<station> – <station>". */
  subtitle?: string;
  color: string;
  /** Stations this step opens, in the order they appear. */
  stations: string[];
};

/** One change in the timeline, for a list of changes: its caption and where it plays. */
export type ChangeInfo = StepInfo & {
  /** Its position in the timeline: what `showChange` and `playFrom` take. */
  index: number;
};

/** One line at a station, for a station panel. */
export type StationLineInfo = {
  id: string;
  name: string;
  color: string;
  /** When it opened here; `null` for a plan's line, which has no date. */
  opened: IsoDate | null;
  closed?: IsoDate;
};

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
export type LineInfo = {
  id: string;
  name: string;
  network: string;
  networkName: string;
  color: string;
  /** When it first opened, as a timestamp; `null` for a line only a plan builds. */
  opened: number | null;
};

/** A station as a search lists it: on the map on the date shown. */
export type StationSummary = {
  id: string;
  /** Its name on the date shown. */
  name: string;
  /** That name in the network's other languages. */
  otherNames: string[];
  /** The colours of the lines that call there, in line order. */
  colors: string[];
};

/** A stop on a line, for a line's panel. */
export type LineStop = { id: string; name: string };

/** A line on the date shown, for a line's panel. */
export type LineDetails = LineInfo & {
  /** Its stops on the date shown. */
  stations: number;
  /** Its open track on the date shown, km. */
  km: number;
  /**
   * Its stops in the order it runs, as runs of track: the longest first, then each branch, whose
   * first stop is the station it leaves from. Empty when it is not open.
   */
  branches: LineStop[][];
  /** The changes that are part of its story, by their position in the timeline (`ChangeInfo.index`). */
  changes: number[];
};

/** What a route is best at: arriving soonest, or changing least, if it takes a little longer. */
export type RoutePreference = ModelRoutePreference;

/** A station on a route. */
export type RouteStop = { id: string; name: string };

/** One part of a route: a ride on a line from where it is boarded to where it is left, or a walk between two stations. */
export type RouteLegInfo =
  | {
      kind: 'ride';
      line: string;
      lineName: string;
      color: string;
      /** Its stops, from the one boarded at to the one left at. */
      stops: RouteStop[];
      minutes: number;
      km: number;
    }
  | { kind: 'walk'; from: RouteStop; to: RouteStop; minutes: number };

/** How to get from one station to another on the date shown. */
export type RouteInfo = {
  from: RouteStop;
  to: RouteStop;
  legs: RouteLegInfo[];
  /** About how long it takes, changes and walks included. */
  minutes: number;
  /** How far it rides. */
  km: number;
  /** How many times it changes line. */
  changes: number;
  /** The track it rides, by segment: what `showRoute` draws. */
  segments: number[][];
};

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
