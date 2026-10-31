import type { CoverageInfo, NetworkStats, ReachInfo, RouteInfo, RoutePreference, StepInfo, Theme } from '@railtime/network/facts.types';
import type { NetworkModel } from '@railtime/network/model.service';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { LngLat } from '@railtime/schema/network.types';
import type { Map as MapLibreMap, MapOptions } from 'maplibre-gl';

/** `follow` frames each change, `overview` the change plus the network so far, `free` leaves the camera alone. */
export type CameraMode = 'follow' | 'overview' | 'free';

/** How the map is seen: flat from above, or tilted in 3D, the city's buildings standing as the camera comes down. */
export type ViewMode = '2d' | '3d';

/** Room around the map's edges that the camera keeps clear, in pixels. */
export type Padding = { top: number; bottom: number; left: number; right: number };

/** Where the map looks. */
export type MapView = { center: LngLat; zoom: number };

/**
 * How the map is set: everything the app decides and the map shows, as one object (`_ARCHITECTURE.md`,
 * Props). The app owns it and gives it whole or in part to `update`, as often as it likes; the map
 * acts on what changed and never changes it itself.
 */
export type MapProps = {
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
  /** The city's outline, which coverage is measured within; `null` for none (yet). */
  boundary: CityBoundary | null;
};

/** Where `play` starts: here, history's start, or a change (its position in the timeline, as `ChangeInfo.index`). */
export type PlayFrom = 'here' | 'start' | { change: number };

/** Where `seek` goes: the end of a day, just after a change, just before one (playing starts it), today, or the future (everything played). */
export type SeekTarget = { time: number } | { change: number } | { beforeChange: number } | 'today' | 'future';

/** Asks for the next frame, and cancels one asked for: `requestAnimationFrame` unless a test steps frames by hand. */
export type FrameScheduler = {
  request: (frame: (now: number) => void) => number;
  cancel: (id: number) => void;
};

/** A listener for each event, given when the map is made so nothing it says while starting is missed. */
export type TransitMapListeners = { [Name in keyof TransitMapEvents]?: (payload: TransitMapEvents[Name]) => void };

/** What a `TransitMap` is made with. */
export type TransitMapOptions = {
  container: HTMLElement;
  /** The network to draw, and its history: one model, shared with the app. */
  model: NetworkModel;
  /** How it is set at first; what is left out, the defaults (`DEFAULT_MAP_PROPS`). */
  props?: Partial<MapProps>;
  /** Its listeners, from the start. */
  on?: TransitMapListeners;
  /** Where the map opens. Without one it fits the whole network. */
  view?: MapView;
  /** Where to draw the overview inset. Without one there is no minimap. */
  minimapContainer?: HTMLElement;
  /** A MapLibre style URL using the OpenMapTiles schema. Defaults to OpenFreeMap's Positron. */
  basemap?: string;
  /**
   * Where MapLibre's worker script is served. A bundler that moves MapLibre (Vite does) breaks the
   * path it works out itself, so the app passes the URL its bundler gives the file.
   */
  workerUrl?: string;
  /** Whether MapLibre draws its credits on the map (the default). Without them the app must show `credits` itself, as the licences ask. */
  attributionControl?: boolean;
  /** Makes the MapLibre map: MapLibre's own unless a test gives a stand-in. */
  createMap?: (options: MapOptions) => MapLibreMap;
  /** Asks for frames: `requestAnimationFrame` unless a test steps them by hand. */
  scheduler?: FrameScheduler;
};

/** One credit the map owes: the basemap's or the data's. */
export type Credit = { text: string; url?: string };

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
  /** The map is ready: its style loaded, its layers drawn as its props say. */
  status: 'ready';
  /** The clock, cursor, playing state or stats changed. */
  time: TimeState;
  /** A step started (`StepInfo`), or its caption should go (`null`). */
  step: StepInfo | null;
  /** How many of the current step's stations have appeared. */
  stepProgress: number;
  /** A station was clicked (its id), or the map away from any (`null`). */
  stationClick: string | null;
  /** The selected station is not on the map at the moment shown: its ring is hidden while it is away. Its id: advice; the prop stays the app's. */
  selectionGone: string;
  /** The overlay drawn was worked out again, for a new request, date or theme; `null` once it is cleared. */
  overlay: OverlayResult | null;
  /** Playback reached today. */
  end: undefined;
  /** The map stopped moving, by the user's hand or the camera's: where it looks now. */
  view: MapView;
};
