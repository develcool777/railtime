import type { LngLat } from '@railtime/core/geometry.types';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { CoverageDistance, CoverageInfo, NetworkStats, Playhead, ReachInfo, RouteInfo, StepInfo, Theme } from '@railtime/network/facts.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { LineId, StationId } from '@railtime/schema/network.types';
import type { Map as MapLibreMap, MapOptions } from 'maplibre-gl';
import type { FrameRenderer } from './layers/frame.service';
import type { OverlayController } from './overlay/controller.service';
import type { Player } from './playback/player.service';

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
  /**
   * The network drawn, its history and every fact about it: one instance, shared with the app. Another
   * (the network with a plan, or without) is drawn on the same map, at its today, the camera left where it is.
   */
  facts: NetworkFacts;
  theme: Theme;
  /** Flat from above, or tilted in 3D, the buildings standing; playback then follows from close by. */
  viewMode: ViewMode;
  /** Whether the stations are named, or only their dots shown. */
  stationLabels: boolean;
  /** Whether the basemap names its streets and places, or shows the city unnamed but for the stations. */
  streetLabels: boolean;
  /** The lines brought forward, the rest faded, as for a line's panel; `null` for every line alike. A route or a reach fades them all. */
  focusedLines: LineId[] | null;
  /** The station ringed, flown to when it changes; `null` for none. */
  selectedStation: StationId | null;
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

/** Makes a MapLibre map: MapLibre's own, or a test's stand-in. */
export type CreateMap = (options: MapOptions) => MapLibreMap;

/** Asks for the next frame, and cancels one asked for: `requestAnimationFrame` unless a test steps frames by hand. */
export type FrameScheduler = {
  request: (frame: (now: number) => void) => number;
  cancel: (id: number) => void;
};

/** A listener for each event, given when the map is made so nothing it says while starting is missed. */
export type TransitMapListeners = { [Name in keyof TransitMapEvents]?: (payload: TransitMapEvents[Name]) => void };

/**
 * Props given to `update`, whole or in part: one given as `undefined` is one not given, so an app may
 * pass on a value it may not have.
 */
export type MapPropsUpdate = { [Key in keyof MapProps]?: MapProps[Key] | undefined };

/** What a `TransitMap` is made with. */
export type TransitMapOptions = {
  container: HTMLElement;
  /** How it is set at first: the network it draws, and the rest as given or the defaults (`DEFAULT_MAP_PROPS`). */
  props: Pick<MapProps, 'facts'> & MapPropsUpdate;
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
  /** Makes the MapLibre maps, the main one and the minimap's: MapLibre's own unless a test gives a stand-in. */
  createMap?: CreateMap;
  /** Asks for frames: `requestAnimationFrame` unless a test steps them by hand. */
  scheduler?: FrameScheduler;
};

/** What `TransitMap` draws one network with, made again for another: its facts, its player, its overlay and its frames. */
export type NetworkParts = {
  facts: NetworkFacts;
  player: Player;
  overlay: OverlayController;
  frames: FrameRenderer;
};

/** One credit the map owes: the basemap's or the data's. */
export type Credit = { text: string; url?: string };

/**
 * Where playback is: its playhead (the changes done, the clock, how far the next change has been
 * drawn), which `seek` takes back as it is, and what stands round it, as `NetworkFacts.playheads` says.
 */
export type TimeState = Playhead & {
  /** The playhead is today's. */
  atToday: boolean;
  /** The playhead is where the map rests: today, or for a network with a plan the plan built. */
  atRest: boolean;
  /** The map shows a plan: a planned change done, or one being drawn. `time` is then the end of the dates. */
  inPlan: boolean;
  playing: boolean;
  stats: NetworkStats;
};

/**
 * What the map draws over the network, worked out again on each date and theme: one of the ways between
 * two stations (`option`, fastest first: `FactsAt.routes`), how far one gets from a station, or how much
 * of the city is within a distance of one.
 */
export type OverlayRequest =
  { kind: 'route'; from: StationId; to: StationId; option: number } | { kind: 'reach'; from: StationId } | { kind: 'coverage'; metres: CoverageDistance };

/**
 * What the overlay drawn came to on the date shown, for the app to list: a route's every way and the
 * one drawn (the option asked for, or the last there is on the date: `null` for none); `null` for a
 * reach or coverage there is none of on the date.
 */
export type OverlayResult =
  | { kind: 'route'; routes: RouteInfo[]; shown: number | null }
  | { kind: 'reach'; reach: ReachInfo | null }
  | { kind: 'coverage'; coverage: CoverageInfo | null };

/** Events a `TransitMap` emits, by name. */
export type TransitMapEvents = {
  /** The map is ready: its style loaded, its layers drawn as its props say. */
  status: 'ready';
  /** The playhead, playing state or stats changed. */
  time: TimeState;
  /** A step started (`StepInfo`), or its caption should go (`null`). */
  step: StepInfo | null;
  /** How many of the current step's stations have appeared. */
  stepProgress: number;
  /** A station was clicked (its id), or the map away from any (`null`). */
  stationClick: StationId | null;
  /** The selected station is not on the map at the moment shown: its ring is hidden while it is away. Its id: advice; the prop stays the app's. */
  selectionGone: StationId;
  /** The overlay drawn was worked out again, for a new request, date or theme; `null` once it is cleared. */
  overlay: OverlayResult | null;
  /** Playback reached today. */
  end: undefined;
  /** The map stopped moving, by the user's hand or the camera's: where it looks now. */
  view: MapView;
};
