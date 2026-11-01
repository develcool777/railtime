import type { NetworkStats } from '@railtime/network/facts.types';
import type { SideBySide } from './style.types';
import type { LngLat } from '@railtime/core/geometry.types';
import type { RouteStopKind } from '../overlay/overlay.types';

/** Everything already on the map at a cursor. Rebuilt only when the cursor, toggles or theme change. */
export type NetworkSnapshot = {
  sideBySide: SideBySide;
  lines: FeatureCollection<LineFeature>;
  /** A plan's track, drawn dashed in its line's colour. */
  planned: FeatureCollection<LineFeature>;
  /** Closed track, drawn dashed. */
  ghosts: FeatureCollection<LineFeature>;
  /** Stations on the map and the lines serving them. */
  stations: Map<string, StationLines>;
  /** Transfers with both stations on the map: a link between their dots. */
  transfers: FeatureCollection<LineFeature>;
  /** Stations on the map with a transfer to another on the map: drawn as interchanges. */
  linked: Set<string>;
  /** Stations on the map that only a plan's track reaches: drawn as rings. */
  plannedStations: Set<string>;
  /** Stations all of whose lines are closing in the step playing now: they fade out with it. */
  closingOnly: Set<string>;
  stats: NetworkStats;
};

/** Minimal GeoJSON, so the renderer needs no @types/geojson. */
type Feature<Geometry, Properties> = { type: 'Feature'; properties: Properties; geometry: Geometry };

/** A GeoJSON feature collection. */
export type FeatureCollection<Item> = { type: 'FeatureCollection'; features: Item[] };

/** Properties of a drawn line. */
type LineProperties = {
  color: string;
  /** Side-by-side slot on shared track: …-1, -0.5, 0, 0.5, 1… (see `lineStyle.utils.ts`). */
  offset: number;
  /** 1 for new track while its step plays, fading to 0. Draws it wider. */
  highlight: number;
  /** The line it is drawn for, so the app can bring some lines forward (`focusLines`); empty for a transfer's link. */
  line: string;
  /** A plan's track, not built: drawn dashed, growing as it stands. */
  planned: boolean;
};

/** A drawn line. */
export type LineFeature = Feature<{ type: 'LineString'; coordinates: LngLat[] }, LineProperties>;

/** A stretch of a route: ridden on a line, in its colour, or walked between two stations. */
export type RouteFeature = Feature<{ type: 'LineString'; coordinates: LngLat[] }, { color: string; walk: boolean }>;

/** A stretch of track a reach colours, in its band's colour. */
export type ReachTrackFeature = Feature<{ type: 'LineString'; coordinates: LngLat[] }, { color: string }>;

/** Properties of a station a reach gets to: its band's colour, its name and time, and whether it is the start. */
export type ReachStopProperties = { color: string; label: string; minutes: number; origin: boolean };

/** A ring of a city's outline. */
export type OutlineFeature = Feature<{ type: 'LineString'; coordinates: LngLat[] }, Record<string, never>>;

/** Properties of a stop on a route: how it is marked, its line's colour, and its name. */
export type RouteStopProperties = { kind: RouteStopKind; color: string; name: string };

/** A drawn point. */
export type PointFeature<Properties> = Feature<{ type: 'Point'; coordinates: LngLat }, Properties>;

/**
 * Properties of a station dot: what it is and shows, sent to MapLibre when they change. How it looks
 * this frame, as it pops in or fades, is its `StationLook`, set as feature state.
 */
export type StationProperties = {
  id: string;
  name: string;
  /** Served by more than one (effective) line. */
  interchange: boolean;
  color: string;
  /** Opened in the step playing now: pulses, and is labelled at any zoom. */
  highlighted: boolean;
  /** The name it had, while the step playing renames it: labelled under the new; `''` for none. */
  former: string;
  /** Closing in the step playing: labelled at any zoom, marked closed, as its dot fades. */
  closing: boolean;
  /** Only planned track reaches it: drawn hollow. */
  planned: boolean;
};

/** How a station dot looks this frame: its feature state, changed with no data sent. */
export type StationLook = {
  /** Pop-in scale, 0 → 1 (overshoots a little on the way). */
  scale: number;
  opacity: number;
  /** A new station's label fades at the end of its step while the dot stays. */
  labelOpacity: number;
};

/** Properties of a ring round a station: a new one's pulse, or a closing one's, closing in. */
export type PulseProperties = { id: string; color: string };

/** How a ring looks this frame: its feature state. */
export type PulseLook = { radius: number; opacity: number };

/** Properties of the glowing dot at a growing line's tip. */
export type HeadProperties = { color: string };

/** The lines serving a station: effective line id to colour. */
export type StationLines = Map<string, string>;
