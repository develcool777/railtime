import type { IsoDate, LngLat, Network } from '@railtime/schema/network.types';
import type { DecadeOpenings as ModelDecadeOpenings, YearStats as ModelYearStats } from './network/history.types';
import type { RoutePreference as ModelRoutePreference } from './route/finder.types';
import type { Step } from './network/timeline.types';

/** The map's colour theme. */
export type Theme = 'dark' | 'light';

/** `follow` frames each change, `overview` the change plus the network so far, `free` leaves the camera alone. */
export type CameraMode = 'follow' | 'overview' | 'free';

/** How the map is seen: flat from above, or tilted in 3D, the city's buildings standing as the camera comes down. */
export type ViewMode = '2d' | '3d';

/** Room around the map's edges that the camera keeps clear, in pixels. */
export type Padding = { top: number; bottom: number; left: number; right: number };

/** Where the map looks. */
export type MapView = { center: LngLat; zoom: number };

/**
 * How the map is set: what the app decides and the map shows, as one object. The app keeps it and
 * gives it whole or in part to `apply`; the map acts on what changed. What it is asked to do once (zoom,
 * play, seek) is a method; what it says back, an event.
 */
export type MapState = {
  theme: Theme;
  /** Flat from above, or tilted in 3D, the buildings standing; playback then follows from close by. */
  viewMode: ViewMode;
  /** Whether the stations are named, or only their dots shown. */
  stationLabels: boolean;
  /** The lines shown; `null` for every line. */
  visibleLines: string[] | null;
  /** The lines brought forward, the rest faded, as for a line's panel; `null` for every line alike. A route or a reach fades them all. */
  focusedLines: string[] | null;
  /** The station ringed, flown to when it changes; `null` for none. */
  selectedStation: string | null;
  /** What is drawn over the network, worked out again on each date and theme; `null` for nothing. */
  overlay: OverlayRequest | null;
  /** The playback speed: 1 is normal. */
  speed: number;
  /** How the camera follows playback. */
  camera: CameraMode;
  /** Room the app's own panels take up, kept clear when the camera frames something. */
  padding: Padding;
  /** Panels the app lays over the map's edges, pixels: the map's centre and every frame stay clear of them, what is drawn stays put. */
  cover: Padding;
};

/** What a `TransitMap` is created with. */
export type TransitMapOptions = {
  container: HTMLElement;
  network: Network;
  /** How it is set at first; what is left out, the defaults (`DEFAULT_MAP_STATE`). */
  state?: Partial<MapState>;
  /** A MapLibre style URL using the OpenMapTiles schema. Defaults to OpenFreeMap's Positron. */
  basemap?: string;
  /** Where to draw the overview inset. Without one there is no minimap. */
  minimapContainer?: HTMLElement;
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
  /** The track it rides, by segment: what a route overlay draws. */
  segments: number[][];
};

/** A band of a reach: the stations reached within its minutes, in its colour. */
export type ReachBand = {
  /** The most minutes in it; `null` for the last, which has no end. */
  upTo: number | null;
  /** "15–30 min". */
  label: string;
  color: string;
};

/** A station a reach gets to. */
export type ReachStation = { id: string; name: string; minutes: number; band: number };

/** How far one can get from a station on the date shown, and how long it takes. */
export type ReachInfo = {
  from: RouteStop;
  /** Every other station reached, soonest first. */
  stations: ReachStation[];
  /** The bands its stations are coloured in, soonest first. */
  bands: ReachBand[];
};

/** A band of walking distance to the nearest station, nearest first. */
export type CoverageBand = {
  /** The most metres in it. */
  upTo: number;
  /** "400–800 m". */
  label: string;
  color: string;
};

/** A band, and how much of the city lies in it. */
export type CoverageShare = CoverageBand & {
  /** Of the city's area, 0..1. */
  share: number;
  km2: number;
};

/** How much of a city lies within walking distance of a station open on the date shown. */
export type CoverageInfo = {
  /** What the city's outline is: "Greater London". */
  name: string;
  /** Where the outline comes from, as credited. */
  source: string;
  /** The city's area inside its outline. */
  km2: number;
  /** The headline: the share within this many metres. */
  metres: number;
  /** The share of the city within `metres` of a station, 0..1. */
  share: number;
  /** Each band, nearest first. */
  bands: CoverageShare[];
  /** What lies farther than every band. */
  beyond: { share: number; km2: number };
};

/** The share of a city within the headline distance of a station at the end of a year. */
export type CoverageYear = { year: number; share: number };

/** The network at the end of one year. */
export type YearStats = ModelYearStats;

/** How many stations first opened in a decade. */
export type DecadeOpenings = ModelDecadeOpenings;

/** The network year by year, and how many stations opened in each decade. Plans have no date and are not in it. */
export type NetworkGrowth = { years: YearStats[]; decades: DecadeOpenings[] };

/** The network's records on the date shown, each list longest or oldest first. */
export type NetworkRecords = {
  /** The stations open longest, with the year each first opened. */
  oldest: { id: string; name: string; year: number }[];
  /** The stations most lines call at. */
  busiest: { id: string; name: string; lines: { id: string; name: string; color: string }[] }[];
  /** The longest lines. */
  longest: { id: string; name: string; color: string; km: number }[];
};

/**
 * What the map draws over the network, worked out again on each date and theme: a route between two
 * stations, how far one gets from a station, or how much of the city is near one.
 */
export type OverlayRequest = { kind: 'route'; from: string; to: string; preference: RoutePreference } | { kind: 'reach'; from: string } | { kind: 'coverage' };

/** What the overlay drawn came to on the date shown, for the app to list: `null` where there is none on the date. */
export type OverlayResult =
  { kind: 'route'; route: RouteInfo | null } | { kind: 'reach'; reach: ReachInfo | null } | { kind: 'coverage'; coverage: CoverageInfo | null };

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
  /** A station was clicked (its id), or the map away from any (`null`). */
  stationClick: string | null;
  /** The station selected is not on the map on the date now shown: its ring is gone. Its id. */
  selectionGone: string;
  /** The theme changed: the colours of the lines and the changes are its now (`getLines`, `getChanges`). */
  theme: Theme;
  /** The overlay drawn was worked out again, for a new request, date or theme; `null` once it is cleared. */
  overlay: OverlayResult | null;
  /** Playback reached today. */
  end: undefined;
  /** The map stopped moving, by the user's hand or the camera's: where it looks now. */
  view: MapView;
};
